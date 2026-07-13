import os
import logging
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError

from companies.models import Company
from companies.services.company_service import resolve_ticker_by_name, get_company_profile
from research.models import ResearchHistory, SavedReport
from .models import AIConversation, Message
from .serializers import AIConversationSerializer, MessageSerializer
from .agent.graph import build_research_graph
from .agent.prompts import CHAT_FOLLOWUP_PROMPT
from .agent.nodes import get_llm

logger = logging.getLogger(__name__)

class AIConversationViewSet(viewsets.ModelViewSet):
    """
    Manages chat threads for authenticated users.
    """
    serializer_class = AIConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return AIConversation.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MessageViewSet(viewsets.ModelViewSet):
    """
    Manages individual messages.
    Triggers the LangGraph multi-node research graph for the first message,
    and runs a lightweight contextual follow-up model for subsequent messages.
    """
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Message.objects.filter(conversation__user=self.request.user).order_by('timestamp')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        conversation = serializer.validated_data.get('conversation')
        if conversation.user != request.user:
            raise PermissionDenied("You do not have access to this conversation thread.")
            
        user_content = serializer.validated_data.get('content')
        
        # 1. Save user's prompt message
        user_message = Message.objects.create(
            conversation=conversation,
            role='user',
            content=user_content
        )
        
        # 2. Check if this is the first message in the thread (to compile the report)
        message_count = Message.objects.filter(conversation=conversation).count()
        
        if message_count == 1:
            # First message: Trigger the 8-node LangGraph Research Pipeline
            try:
                # Resolve company ticker based on conversation focus or user's prompt query
                focus_query = conversation.company.ticker if conversation.company else user_content
                resolved_ticker = resolve_ticker_by_name(focus_query)
                
                # Fetch profile (this caches/saves the Company object in DB)
                profile = get_company_profile(resolved_ticker)
                company_obj = Company.objects.get(ticker=profile["ticker"])
                
                # Update thread bindings
                conversation.company = company_obj
                conversation.save()
                
                # Compile and invoke LangGraph State Machine
                graph = build_research_graph()
                initial_state = {
                    "ticker": company_obj.ticker,
                    "user_query": user_content,
                    "user_id": request.user.id,
                    "conversation_id": conversation.id,
                    "company_profile": profile
                }
                
                result = graph.invoke(initial_state)
                report_md = result.get("markdown_report", "Research compilation failed.")
                payload = result.get("recommendation_payload", {})
                

                # 4. Save Assistant message reply
                assistant_message = Message.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=report_md,
                    token_usage=1200  # Mock token usage
                )
                
                # 5. Link the saved report to the conversation thread
                latest_report = SavedReport.objects.filter(
                    user=request.user, 
                    company=company_obj
                ).order_by('-created_at').first()
                
                if latest_report:
                    conversation.report = latest_report
                    conversation.save()
                    
                serialized_reply = MessageSerializer(assistant_message)
                return Response(serialized_reply.data, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                # Clean up user message on hard crash to keep thread empty
                user_message.delete()
                raise ValidationError(f"Research pipeline error: {str(e)}")
                
        else:
            # Subsequent message: Run conversational follow-up
            try:
                # 1. Load conversation message log
                history_msgs = Message.objects.filter(conversation=conversation).order_by('timestamp')
                history_str = ""
                for msg in history_msgs:
                    history_str += f"{msg.role.upper()}: {msg.content}\n\n"
                    
                # 2. Load report context if available
                report_content = ""
                if conversation.report:
                    try:
                        # Open local file storage
                        with open(conversation.report.pdf_file.path, 'r', encoding='utf-8') as f:
                            report_content = f.read()
                    except Exception:
                        report_content = f"Title: {conversation.report.title}\nHighlights: {conversation.report.key_highlights}"
                else:
                    report_content = "No report has been compiled yet."

                # 3. Build Prompt & Query Gemini
                prompt = CHAT_FOLLOWUP_PROMPT.format(
                    company_name=conversation.company.name if conversation.company else "Company",
                    ticker=conversation.company.ticker if conversation.company else "Ticker",
                    report_context=report_content,
                    message_history=history_str
                )
                
                llm = get_llm()
                response = llm.invoke(prompt)
                reply_text = response.content
                
                # 4. Save assistant response
                assistant_message = Message.objects.create(
                    conversation=conversation,
                    role='assistant',
                    content=reply_text,
                    token_usage=250  # Mock token usage
                )
                
                serialized_reply = MessageSerializer(assistant_message)
                return Response(serialized_reply.data, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                # Clean up follow-up prompt on error
                user_message.delete()
                raise ValidationError(f"Follow-up error: {str(e)}")
