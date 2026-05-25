import sqlite3
import Levenshtein
from fastapi import FastAPI, Query
from contextlib import asynccontextmanager
import pronouncing

# Global DB connection and cached unique endings
mem_conn = None
unique_word_endings = []
unique_bigram_endings = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mem_conn, unique_word_endings, unique_bigram_endings
    print("Loading rhyme_data.db into memory...")
    disk_conn = sqlite3.connect("rhyme_data.db")
    mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
    disk_conn.backup(mem_conn)
    disk_conn.close()
    
    # Pre-cache unique endings for slant rhyme lookups
    cursor = mem_conn.cursor()
    cursor.execute("SELECT DISTINCT rhyme_ending FROM words")
    unique_word_endings = [r[0] for r in cursor.fetchall() if r[0]]
    
    cursor.execute("SELECT DISTINCT rhyme_ending FROM bigrams")
    unique_bigram_endings = [r[0] for r in cursor.fetchall() if r[0]]
    
    print("Rhyme service startup complete.")
    yield
    if mem_conn:
        mem_conn.close()

app = FastAPI(lifespan=lifespan)

@app.get("/rhyme")
def get_rhyme(word: str = Query(..., description="Query word to find rhymes for")):
    word_clean = word.lower().strip()
    
    phones_list = pronouncing.phones_for_word(word_clean)
    if not phones_list:
        return {
            "word": word,
            "perfect": [],
            "slant": [],
            "perfect_bigrams": [],
            "slant_bigrams": []
        }
        
    phonemes = phones_list[0]
    rhyme_ending = pronouncing.rhyming_part(phonemes)
    if not rhyme_ending:
        return {
            "word": word,
            "perfect": [],
            "slant": [],
            "perfect_bigrams": [],
            "slant_bigrams": []
        }
        
    cursor = mem_conn.cursor()
    
    # 2. Perfect word rhymes
    cursor.execute(
        "SELECT word FROM words WHERE rhyme_ending = ? AND word != ? ORDER BY frequency DESC LIMIT 30",
        (rhyme_ending, word_clean)
    )
    perfect_words = [r[0] for r in cursor.fetchall()]
    
    # 3. Slant word rhymes
    STOPWORDS = {
        "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", 
        "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", 
        "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", 
        "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", 
        "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", 
        "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", 
        "for", "with", "about", "against", "between", "into", "through", "during", "before", 
        "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", 
        "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", 
        "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", 
        "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", 
        "will", "just", "don", "should", "now", "d", "ll", "m", "o", "re", "ve", "y", "ain", 
        "aren", "couldn", "didn", "doesn", "hadn", "hasn", "haven", "isn", "ma", "mightn", 
        "mustn", "needn", "shan", "shouldn", "wasn", "weren", "won", "wouldn",
        "i'm", "you're", "he's", "she's", "it's", "we're", "they're", "i've", "you've", "we've", 
        "they've", "i'd", "you'd", "he'd", "she'd", "we'd", "they'd", "i'll", "you'll", "he'll", 
        "she'll", "we'll", "they'll", "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", 
        "hadn't", "doesn't", "don't", "didn't", "won't", "wouldn't", "shan't", "shouldn't", "can't", 
        "cannot", "couldn't", "mustn't", "let's", "that's", "who's", "what's", "here's", "there's", 
        "when's", "where's", "why's", "how's", "a's", "y'all", "got", "get", "like", "tell", "come", 
        "go", "make", "take", "would", "could", "should"
    }
    
    slant_w_endings = [e for e in unique_word_endings if Levenshtein.distance(rhyme_ending, e) in (1, 2)]
    if not slant_w_endings:
        slant_words = []
    else:
        placeholders = ",".join("?" for _ in slant_w_endings)
        query_params = slant_w_endings + [word_clean]
        cursor.execute(
            f"SELECT word FROM words WHERE rhyme_ending IN ({placeholders}) AND word != ? ORDER BY frequency DESC LIMIT 200",
            query_params
        )
        raw_slant_words = [r[0] for r in cursor.fetchall()]
        slant_words = [w for w in raw_slant_words if len(w) >= 3 and w not in STOPWORDS][:30]
        
    # 4. Perfect bigram rhymes
    cursor.execute(
        "SELECT bigram FROM bigrams WHERE rhyme_ending = ? ORDER BY frequency DESC LIMIT 30",
        (rhyme_ending,)
    )
    perfect_bigrams = [r[0] for r in cursor.fetchall()]
    
    # 5. Slant bigram rhymes
    slant_b_endings = [e for e in unique_bigram_endings if Levenshtein.distance(rhyme_ending, e) in (1, 2)]
    if not slant_b_endings:
        slant_bigrams = []
    else:
        placeholders = ",".join("?" for _ in slant_b_endings)
        cursor.execute(
            f"SELECT bigram FROM bigrams WHERE rhyme_ending IN ({placeholders}) ORDER BY frequency DESC LIMIT 2000",
            slant_b_endings
        )
        raw_slant_bigrams = [r[0] for r in cursor.fetchall()]
        slant_bigrams = []
        for bg in raw_slant_bigrams:
            parts = bg.split()
            if len(parts) == 2:
                if len(parts[0]) >= 3 and parts[0] not in STOPWORDS and len(parts[1]) >= 3 and parts[1] not in STOPWORDS:
                    slant_bigrams.append(bg)
            if len(slant_bigrams) >= 30:
                break
        
    return {
        "word": word,
        "perfect": perfect_words,
        "slant": slant_words,
        "perfect_bigrams": perfect_bigrams,
        "slant_bigrams": slant_bigrams
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
