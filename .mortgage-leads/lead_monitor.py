#!/usr/bin/env python3
"""Local helpers for NH mortgage lead monitor state."""
from __future__ import annotations
import json, re
from datetime import datetime, timezone
from pathlib import Path

BASE = Path('/workspace/.mortgage-leads')
ALERTED = BASE / 'alerted.json'
WATCHLIST = BASE / 'watchlist.json'

ADVICE_RE = re.compile(
    r"looking for|need (help|a lender|advice)|anyone recommend|should i|can i |"
    r"how (do|can) i|pre-?approv|first[- ]?time|refinance|bankruptcy|"
    r"talk to a lender|qualify|credit|pmi|usda|fha|va loan|conventional|"
    r"down payment|\?",
    re.I,
)
SPAM_RE = re.compile(r"unlock financial|loan solutions|sdn bhd|whatsapp|click here", re.I)
NH_RE = re.compile(r"\bnh\b|new hampshire|manchester|nashua|concord|portsmouth|seacoast|new england", re.I)


def load_alerted():
    return json.loads(ALERTED.read_text())


def load_watchlist():
    return json.loads(WATCHLIST.read_text())


def save_alerted(data):
    ALERTED.write_text(json.dumps(data, indent=2) + '\n')


def score_comment(text: str) -> int:
    if len(text) < 30 or SPAM_RE.search(text) or not ADVICE_RE.search(text):
        return 0
    score = 0
    if NH_RE.search(text):
        score += 5
    if re.search(r"talk to a lender|need (help|a lender)|looking for|anyone recommend|do you help", text, re.I):
        score += 4
    if re.search(r"bankruptcy|denied|unhappy|want out|lost .*lender", text, re.I):
        score += 4
    if re.search(r"first[- ]?time|pre-?approv|credit|pmi|usda|fha|va |conventional", text, re.I):
        score += 2
    if re.search(r"should i|can i|how (do|can)|what about|\?", text, re.I):
        score += 2
    return score


def filter_new_leads(comments, alerted_ids, last_scan_at=None, min_score=4):
    out = []
    for c in comments:
        cid = c.get('id')
        if not cid or cid in alerted_ids:
            continue
        if last_scan_at and (c.get('published') or '') <= last_scan_at:
            # still allow high-score backlog only when explicitly requested
            pass
        score = score_comment(c.get('text') or '')
        if score >= min_score:
            c = dict(c)
            c['score'] = score
            c['nh'] = bool(NH_RE.search(c.get('text') or ''))
            out.append(c)
    out.sort(key=lambda x: (-x['score'], x.get('published') or ''))
    return out


def mark_scan(new_leads=None, notes=''):
    a = load_alerted()
    now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    a['last_scan_at'] = now
    if new_leads:
        ids = a.setdefault('alerted_comment_ids', [])
        for lead in new_leads:
            if lead['id'] not in ids:
                ids.append(lead['id'])
        a['alerted_comment_ids'] = sorted(set(a['alerted_comment_ids']))
        a['alerts_sent'] = int(a.get('alerts_sent') or 0) + 1
        a['last_email_alert_at'] = now
        a['last_scan_new_leads'] = len(new_leads)
    else:
        a['last_scan_new_leads'] = 0
    if notes:
        a['last_scan_notes'] = notes
    save_alerted(a)
    return a


BOOKING_QS = [
    'Purchase or refinance?',
    'Where are you buying / located? (NH filter)',
    'First-time buyer?',
    'Rough price or payment goal?',
    'Timeline: 30 / 60 / 90 days?',
    'Already with a lender? Happy with them?',
    'Want a free 15-min options call — morning or evening?',
]

if __name__ == '__main__':
    a = load_alerted()
    w = load_watchlist()
    print('alerts_sent', a.get('alerts_sent'))
    print('alerted_ids', len(a.get('alerted_comment_ids') or []))
    print('videos', len(w.get('priority_video_ids') or []))
    print('brand', (w.get('brand') or {}).get('name'))
