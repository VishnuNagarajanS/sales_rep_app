import os
import PyPDF2
from bs4 import BeautifulSoup
import re

pdf_dir = r"C:\sales_rep_app\GHL details"
website_file = r"C:\Users\ADMIN\.gemini\antigravity-ide\brain\eab00989-3183-46b2-88e0-73fceeab10f2\.system_generated\steps\12295\content.md"
output_file = r"C:\sales_rep_app\backend\Data\CompanyKnowledge.txt"

knowledge = []

# 1. Parse Website content
with open(website_file, 'r', encoding='utf-8') as f:
    html_content = f.read()
    # Assuming the markdown file contains HTML
    soup = BeautifulSoup(html_content, 'html.parser')
    text = soup.get_text(separator='\n', strip=True)
    
    # Simple clean up of multiple newlines
    text = re.sub(r'\n+', '\n', text)
    knowledge.append("=== SOURCE: GHL India Ventures Website ===\n" + text)

# 2. Parse PDFs
for filename in os.listdir(pdf_dir):
    if filename.lower().endswith('.pdf'):
        filepath = os.path.join(pdf_dir, filename)
        pdf_text = []
        try:
            with open(filepath, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text = page.extract_text()
                    if text:
                        pdf_text.append(text)
            
            if pdf_text:
                full_text = "\n".join(pdf_text)
                full_text = re.sub(r'\n+', '\n', full_text)
                knowledge.append(f"\n=== SOURCE: Document - {filename} ===\n{full_text}")
        except Exception as e:
            print(f"Error reading {filename}: {e}")

# Save to output file
with open(output_file, 'w', encoding='utf-8') as f:
    f.write("\n\n".join(knowledge))

print(f"Successfully extracted knowledge to {output_file}")
