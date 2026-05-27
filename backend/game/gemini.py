import io
import os
import random
import logging
from PIL import Image, ImageDraw
from google import genai
from google.genai import types
from google.genai.errors import APIError

logger = logging.getLogger(__name__)

FALLBACK_IMAGE_SIZE = 512
LINE_WRAP_WIDTH = 20
MAX_PROMPT_DISPLAY_LINES = 5

def _get_client():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        logger.error("Failed to initialize GenAI client: %s", e)
        return None

def generate_target_image(prompt: str) -> bytes:
    client = _get_client()
    if not client:
        return generate_fallback_image(prompt)
    
    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-image-preview",
            contents=[prompt],
        )
        if response.parts:
            for part in response.parts:
                if part.inline_data is not None:
                    return part.inline_data.data
    except APIError as e:
        logger.error("GenAI image generation API error: %s", e)
    except Exception as e:
        logger.error("GenAI image generation unexpected error: %s", e)
        
    return generate_fallback_image(prompt)

def evaluate_image_similarity(target_image_bytes: bytes, submission_image_bytes: bytes) -> int:
    client = _get_client()
    if not client:
        return random.randint(3, 6)
        
    try:
        target_img = Image.open(io.BytesIO(target_image_bytes))
        submission_img = Image.open(io.BytesIO(submission_image_bytes))
        
        prompt = (
            "Compare these two images. The first image is the target image. "
            "The second image is a player's attempt to recreate the target image. "
            "Rate the similarity of the content, style, and layout on a integer scale from 1 to 7, "
            "where 1 is completely different and 7 is almost identical. "
            "Output ONLY the integer digit between 1 and 7, and absolutely nothing else. "
            "Do not include explanations, formatting, markdown, or words."
        )
        
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, target_img, submission_img]
        )
        
        text = response.text.strip()
        for char in text:
            if char.isdigit():
                val = int(char)
                if 1 <= val <= 7:
                    return val
    except APIError as e:
        logger.error("GenAI evaluate similarity API error: %s", e)
    except Exception as e:
        logger.error("GenAI evaluate similarity unexpected error: %s", e)
        
    return random.randint(3, 6)

def generate_fallback_image(prompt: str) -> bytes:
    size = (FALLBACK_IMAGE_SIZE, FALLBACK_IMAGE_SIZE)
    img = Image.new("RGB", size, color=(random.randint(20, 80), random.randint(20, 80), random.randint(20, 80)))
    d = ImageDraw.Draw(img)
    words = prompt.split()
    lines = []
    current_line = []
    for word in words:
        current_line.append(word)
        if len(" ".join(current_line)) > LINE_WRAP_WIDTH:
            lines.append(" ".join(current_line))
            current_line = []
    if current_line:
        lines.append(" ".join(current_line))
    
    y = 150
    d.text((50, y), "AI Prompt Battle", fill=(255, 255, 255))
    y += 40
    d.text((50, y), "(Mock Mode / Fallback Image)", fill=(200, 200, 200))
    y += 50
    for line in lines[:MAX_PROMPT_DISPLAY_LINES]:
        d.text((50, y), line, fill=(240, 240, 240))
        y += 30
        
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()
