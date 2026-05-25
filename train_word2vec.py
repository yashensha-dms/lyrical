import csv
import re
import os
import sys
from gensim.models import Word2Vec
def main():
    csv_path = r"D:\Projects\dataset\CLEANDATASET\unique_lines_clean.csv"
    model_path = "songwriting_word2vec.model"
    
    if not os.path.exists(csv_path):
        print(f"Error: Dataset not found at {csv_path}")
        sys.exit(1)
        
    print(f"Loading dataset from {csv_path}...")
    
    sentences = []
    
    # Pre-compiled regex for tokenizing words (keeping internal apostrophes)
    word_regex = re.compile(r"[a-zA-Z]+'[a-zA-Z]+|[a-zA-Z]+")
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            # Skip header if it is present
            header = next(reader, None)
            
            for idx, row in enumerate(reader):
                if not row:
                    continue
                line_text = row[0]
                words = word_regex.findall(line_text.lower())
                if words:
                    sentences.append(words)
                if (idx + 1) % 100000 == 0:
                    print(f"Tokenized {idx + 1} lines...")
    except Exception as e:
        print(f"Error reading CSV file: {e}")
        print("Attempting simple line-by-line fallback...")
        sentences = []
        with open(csv_path, 'r', encoding='utf-8') as f:
            # Skip first line if it is header
            first_line = f.readline()
            for idx, line in enumerate(f):
                # Clean up quotes/commas from simple line
                clean_line = line.strip().strip('"').strip("'")
                words = word_regex.findall(clean_line.lower())
                if words:
                    sentences.append(words)
                if (idx + 1) % 100000 == 0:
                    print(f"Tokenized {idx + 1} lines (fallback)...")

    print(f"Tokenization complete. Total sentences/lines for training: {len(sentences)}")
    
    print("Training Word2Vec model (Skip-gram, size=300, window=10, min_count=2, epochs=40)...")
    print("This may take some time depending on your system CPU. Please wait...")
    
    model = Word2Vec(
        sentences=sentences,
        vector_size=300,
        window=10,
        min_count=2,
        workers=os.cpu_count() or 4,
        sg=1,  # Skip-gram
        epochs=40
    )
    
    print(f"Training finished! Saving model to {model_path}...")
    model.save(model_path)
    print("Model saved successfully. You can now use it in the FastAPI server.")
if __name__ == "__main__":
    main()
