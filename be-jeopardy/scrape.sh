#!/bin/bash
# Helper script to scrape questions and load into database
# Usage: ./scrape.sh [scraper_name]
# Example: ./scrape.sh jeopardy  (runs scrapers/jeopardy.py)

set -e

SCRAPER=${1:-jeopardy}

echo "🔍 Running ${SCRAPER}.py scraper..."
python scrapers/${SCRAPER}.py

echo "📦 Moving scraped data to clues directory..."
mv scrapers/*.tsv clues/ 2>/dev/null || echo "No TSV files to move"

echo "💾 Inserting clues into database..."
python insert_clues.py

echo "🔄 Adding answer alternatives..."
python add_alternatives.py

echo "✅ Done! Database populated with questions."
