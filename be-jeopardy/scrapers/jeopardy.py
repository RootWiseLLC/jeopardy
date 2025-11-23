import csv
import re
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup


SEASON_START = 30
SEASON_END = 40
MAX_GAMES = 2000  # total games scraped across all seasons (adjust for testing)

SCRIPT_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = SCRIPT_DIR / 'jeopardy_seasons_30_40.tsv'


def parse_games(rows):
    games = []
    for row in rows:
        tds = row.find_all('td')
        if len(tds) != 3:
            continue
        link = tds[0].find('a')
        if not link:
            continue
        games.append(link.get('href'))
    return games


def scrape_game(path):
    game_url = f'https://j-archive.com/{path}'
    resp = requests.get(game_url)
    if resp.status_code != 200:
        print(resp)
        print(f'Failed to fetch the game page: {game_url}')
        return []
    game_soup = BeautifulSoup(resp.text, 'html.parser')
    round_tables = game_soup.find_all('table', class_='round')
    final_tables = game_soup.find_all('table', class_='final_round')
    if len(round_tables) != 2 or len(final_tables) >= 3:
        print(f'Skipping malformed game: {game_url}')
        return []
    air_date = datetime.strptime(game_soup.find(
        id='game_title').text.split(' - ')[1], "%A, %B %d, %Y").strftime("%Y-%m-%d")

    extracted = []
    rnd_num = 1
    for rnd in round_tables:
        categories = [c.text for c in rnd.find_all(
            'td', class_='category_name')]
        category_comments = [c.text for c in rnd.find_all(
            'td', class_='category_comments')]
        if len(categories) != 6 or len(category_comments) != 6:
            print(f'Skipping game with unexpected category count: {game_url}')
            return []
        clues = rnd.find_all('td', class_='clue')
        col = 0
        for clue in clues:
            val = clue.find('td', class_='clue_value')
            daily_double = False
            if val is None:
                val = clue.find('td', class_='clue_value_daily_double')
                if val is None:
                    continue
                val = int("".join(re.findall(r'\d+', val.text)))
                daily_double = True
            else:
                val = int("".join(re.findall(r'\d+', val.text)))
            texts = clue.find_all('td', class_='clue_text')
            if len(texts) != 2:
                continue
            answer, question = texts
            extracted.append({
                'round': rnd_num,
                'clue_value': val,
                'daily_double_value': val if daily_double else 0,
                'category': categories[col],
                'comments': category_comments[col],
                'answer': answer.text,
                'question': question.find('em', class_='correct_response').text,
                'air_date': air_date,
                'notes': ''
            })
            col = (col+1) % 6
        rnd_num += 1

    for ft in final_tables:
        texts = ft.find_all('td', class_='clue_text')
        if len(texts) != 2:
            continue
        answer, question = texts
        extracted.append({
            'round': 3,
            'clue_value': 0,
            'daily_double_value': 0,
            'category': ft.find('td', class_='category_name').text,
            'comments': ft.find('td', class_='category_comments').text,
            'answer': answer.text,
            'question': question.find('em', class_='correct_response').text,
            'air_date': air_date,
            'notes': ''
        })

    print(f'Scraped game {path}')
    return extracted


def scrape_season(season_num, games_needed, collected, games_scraped):
    url = f'https://j-archive.com/showseason.php?season={season_num}'
    response = requests.get(url)
    if response.status_code != 200:
        print(f'Failed to fetch season {season_num}')
        return collected
    soup = BeautifulSoup(response.text, 'html.parser')
    tables = soup.find_all('table')
    if len(tables) != 1:
        print(f'Unexpected layout for season {season_num}, skipping')
        return collected
    rows = tables[0].find_all('tr')
    games = parse_games(rows)
    print(f'Season {season_num}: found {len(games)} games')

    for path in games:
        if games_scraped >= games_needed:
            break
        game_clues = scrape_game(path)
        if not game_clues:
            continue
        collected.extend(game_clues)
        games_scraped += 1
        print(f'Total games scraped: {games_scraped}/{games_needed}')
    return collected, games_scraped


def main():
    games_needed = MAX_GAMES if MAX_GAMES > 0 else float('inf')
    questions = []
    games_scraped = 0

    for season in range(SEASON_START, SEASON_END + 1):
        if games_scraped >= games_needed:
            break
        print(f'--- Scraping season {season} ---')
        questions, games_scraped = scrape_season(
            season, games_needed, questions, games_scraped)

    with open(OUTPUT_FILE, 'w') as file:
        csv_writer = csv.writer(file, delimiter='\t')
        headers = ['round', 'clue_value', 'daily_double_value', 'category',
                   'comments', 'answer', 'question', 'air_date', 'notes']
        csv_writer.writerow(headers)
        csv_writer.writerows([q.values() for q in questions])
    print(f'Wrote {len(questions)} clues to {OUTPUT_FILE}')


if __name__ == '__main__':
    main()
