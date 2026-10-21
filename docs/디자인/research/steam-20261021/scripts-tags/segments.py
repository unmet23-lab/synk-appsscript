# -*- coding: utf-8 -*-
"""Relevance tier and segment (분야) classification.

Inputs per app: GetItems user tags ordered by weight (top 20), name + short description.
All rules are written out in report.md section 1.
"""
import re

from queries import QUERIES

U1_TAGS = {'Life Sim', 'Cozy', 'Farming Sim', 'Farming', 'Agriculture', 'Wholesome', 'Colony Sim', 'Dating Sim',
           'Shop Keeper', 'Hobby Sim', 'Decorating', 'Organizing', 'Cleaning', 'Fishing', 'Cooking', 'Job Simulator',
           'Desktop Companion'}
# a U1 tag only counts when the same top-10 also carries one of these context tags (meme-tag guard:
# e.g. ULTRAKILL has Dating Sim at #9 next to FPS tags only)
CONTEXT_TAGS = {'Simulation', 'Life Sim', 'Cozy', 'Relaxing', 'Casual', 'Wholesome', 'Farming Sim', 'Management',
                'Visual Novel', 'Romance', 'Choices Matter', 'Cute', 'Family Friendly', 'Sandbox', 'Building',
                'Crafting', 'Colony Sim', 'Cooking', 'Time Management', 'Job Simulator', 'Shop Keeper', 'Base Building',
                'Agriculture', 'Dating Sim', 'Otome', 'Nature', 'Hobby Sim', 'Decorating', 'Organizing', 'Cleaning',
                'Desktop Companion', 'Idler', 'Farming', 'Fishing', 'City Builder', 'Interactive Fiction', 'Economy',
                'Resource Management', 'Character Customization', 'Emotional', 'Story Rich', 'Utilities'}
LANG_CORE = {'Education', 'Language Learning', 'Word Game', 'Spelling'}
LANG_ADJ = {'Typing', 'Trivia'}
U2_TAGSETS = {q[0]: q[1] for q in QUERIES if q[2] == 'U2'}
# broad "X AND Relaxing" queries: kept in the data, not used for ranking eligibility
WEAK_U2 = {'building_relax', 'basebuilding_relax', 'crafting_relax', 'sandbox_relax', 'management_relax'}
ADULT_TAGS = {'Hentai', 'Sexual Content', 'Nudity', 'NSFW'}

SEG_ORDER = ['farm_life', 'town_community', 'relationship', 'home_decor', 'colony_emergent', 'shop_service',
             'animal_pet', 'fishing', 'study_idle', 'async_warmth', 'language_edu']
SEG_KO = {
    'farm_life': '농사·생활',
    'town_community': '마을 만들기·공동체',
    'relationship': '관계·연애',
    'home_decor': '집 꾸미기',
    'colony_emergent': '군락·창발 시뮬',
    'shop_service': '가게·손님 응대·대화',
    'animal_pet': '동물·펫 돌봄',
    'fishing': '낚시',
    'study_idle': '공부 동반·방치형',
    'async_warmth': '비동기 온기(채팅 없는 교류)',
    'language_edu': '언어 학습·교육',
}


def _names(rec, k):
    return [t.get('name') for t in (rec.get('tags') or [])[:k]]


def _text(rec):
    return ' '.join(x for x in [rec.get('name') or '', rec.get('short_description') or ''] if x).lower()


def has(text, pat):
    return re.search(pat, text) is not None


def adult_flag(rec):
    """Adult = Steam content descriptor 3 (Adult Only Sexual Content) or 4 (Frequent Nudity or
    Sexual Content), or Hentai / Sexual Content / Nudity / NSFW among the top-5 user tags
    (top-5, not top-10: inZOI carries a user-voted Sexual Content tag at #10 with no descriptor)."""
    if set(_names(rec, 5)) & ADULT_TAGS:
        return True
    ids = [int(x) for x in (rec.get('content_descriptor_ids') or []) if str(x).isdigit()]
    return 3 in ids or 4 in ids


DOMINANT_OFF = {'Horror', 'Psychological Horror', 'Survival Horror', 'Gore', 'FPS', 'Shooter', 'Boomer Shooter',
                'Souls-like', 'Bullet Hell', 'Military', 'War', 'RTS', 'Real Time Tactics', 'Wargame', 'Hack and Slash',
                'Action Roguelike', 'Bullet Heaven'}


def relevance(rec, tagid_name):
    """core / adjacent / peripheral for the life list; lang_core / lang_adjacent / lang_peripheral.

    peripheral also when horror / shooting / war tags hold the top-3 and no life tag is in the top-3
    (e.g. Doki Doki Literature Club!, Stronghold Crusader HD)."""
    t10 = _names(rec, 10)
    s10 = set(t10)
    top3 = set(t10[:3])
    top5 = set(t10[:5])
    out = {}
    core_hits = [t for t in t10 if t in U1_TAGS and (s10 - {t}) & CONTEXT_TAGS]
    dominated = bool(top3 & DOMINANT_OFF) and not (top3 & U1_TAGS)
    out['dominated_by'] = sorted(top3 & DOMINANT_OFF) if dominated else []
    # store "Games" category still carries some tools (e.g. DFHack, SteamVR): Software among the top-3 tags
    out['tool'] = 'Software' in top3
    vn_like = bool(top5 & {'Visual Novel', 'Dating Sim', 'Otome', 'Interactive Fiction'})
    if out['tool'] or dominated:
        out['life'] = 'peripheral'
    elif core_hits:
        out['life'] = 'core'
    else:
        strong, weak = False, False
        for q in rec.get('source_queries') or []:
            tags = U2_TAGSETS.get(q)
            if not tags:
                continue
            names = {tagid_name.get(int(x)) for x in tags.split(',')}
            if names and names <= s10:
                if q in WEAK_U2:
                    weak = True
                else:
                    strong = True
        # a broad "X AND Relaxing" match counts once a core life tag sits in the top-20 (Spiritfarer, Potion Craft)
        u1_top20 = bool(set(_names(rec, 20)) & U1_TAGS)
        if strong or (weak and u1_top20):
            out['life'] = 'adjacent'
        else:
            out['life'] = 'adjacent_weak' if weak else 'peripheral'
    out['life_hits'] = core_hits
    # Word Game / Spelling / Typing / Trivia are also voted onto text-heavy visual novels; those do not count
    if out['tool']:
        out['lang'] = 'lang_peripheral'
    elif s10 & {'Language Learning', 'Education'}:
        out['lang'] = 'lang_core'
    elif s10 & {'Word Game', 'Spelling'} and not vn_like:
        out['lang'] = 'lang_core'
    elif s10 & LANG_ADJ and not vn_like:
        out['lang'] = 'lang_adjacent'
    else:
        out['lang'] = 'lang_peripheral'
    return out


LIFE_ANCHORS = {'Life Sim', 'Cozy', 'Wholesome', 'Farming Sim', 'Relaxing', 'Cute', 'Casual', 'Simulation', 'Agriculture'}
ANIMAL_TAGS = {'Cats', 'Dogs', 'Animals', 'Horses', 'Birds', 'Foxes', 'Capybaras', 'Wolves', 'Zoo', 'Creature Collector'}
TOWN_WORDS = r'\b(town|towns|village|villages|villagers?|townsfolk|townspeople|community|neighbou?rs?|neighbou?rhood|islanders?|residents?|settlers?|citizens)\b'
REL_WORDS = r'\b(romance|romanc\w+|dating|relationships?|friendships?|befriend\w*|marry|marriage|fall in love|bonds?)\b'
DECO_WORDS = r'(decorat\w+|furnish\w*|furniture|interior|renovat\w+|dream home|cozy home|your (own )?(home|house|room|apartment)|design (your|a) (home|house|room))'
EMERGE_WORDS = r'(simulat\w+|emergent|colon\w+|citizens|their own lives|autonom\w+|generations?|procedural)'
SHOP_WORDS = r'\b(shop|shops|shopkeep\w*|store|caf[eé]|coffee|bakery|restaurant|bar|bartend\w*|customers?|serve|serving|tea ?shop|bookshop|diner|inn|tavern|boutique|florist|merchant|stall)\b'
CARE_WORDS = r'(\bvirtual pets?\b|\bpet (care|shop|sim\w*|simulation)\b|\byour (own )?pets?\b|\badopt\w*|\bcare for\b|\bcaring for\b|\btake care\b|\braise\b|\braising\b|\bveterinar\w+|\bshelter\b|\bkittens?\b|\bpupp(y|ies)\b|\bfeed\b|\bfeeding\b|\bgroom\w*|\brescue\w*|\branch\w*|\bwrangl\w*|\bbreed\w*|\btame\b|\btaming\b|\bnurtur\w+)'
ANIMAL_WORDS = r'\b(cats?|dogs?|animals?|horses?|birds?|creatures?|critters?|slimes?|pets?|ducks?|axolotls?|foxes|capybaras?|wolves|wolf|kittens?|pupp(y|ies)|dinosaurs?|monsters?|fish)\b'
FISH_WORDS = r'\b(fish|fishing|angl\w+|catch\w*)\b'
STUDY_WORDS = r'(\bstudy|\bstudying|\bfocus\b|pomodoro|productiv\w+|while you work|work session|\bdesktop\b|lo-?fi|\bidle\b|\bafk\b|in the background|co-?working|to-?do)'
ASYNC_WORDS = r'(other players|messages? from|letters?|anonymous\w*|strangers?|leave (a )?(note|message)s?|kind words|asynchron\w+|player-made|from around the world|people around the world)'


def classify(rec):
    t10 = set(_names(rec, 10))
    t20 = set(_names(rec, 20))
    tx = _text(rec)
    layers = set(rec.get('layers') or [])
    segs = []
    if t10 & {'Farming Sim', 'Agriculture', 'Farming'} or ('Life Sim' in _names(rec, 5)):
        segs.append('farm_life')
    if ('City Builder' in t10 and t10 & (LIFE_ANCHORS | {'Building', 'Relaxing'})) or \
       (has(tx, TOWN_WORDS) and t10 & {'Building', 'City Builder', 'Base Building', 'Colony Sim', 'Farming Sim', 'Life Sim', 'Crafting'}):
        segs.append('town_community')
    if (t10 & {'Dating Sim', 'Romance', 'Otome'} and t10 & (CONTEXT_TAGS - {'Dating Sim'})) or \
       (has(tx, REL_WORDS) and t10 & {'Life Sim', 'Cozy', 'Wholesome', 'Farming Sim'}):
        segs.append('relationship')
    if t20 & {'Decorating', 'Organizing'} or (has(tx, DECO_WORDS) and t10 & {'Building', 'Life Sim', 'Cozy', 'Relaxing', 'Simulation', 'Casual', 'Wholesome'}):
        segs.append('home_decor')
    if t10 & {'Colony Sim', 'God Game'} or ('Sandbox' in t10 and 'Life Sim' in t10 and has(tx, EMERGE_WORDS)):
        segs.append('colony_emergent')
    if t10 & {'Shop Keeper', 'Cooking', 'Job Simulator'} or \
       (has(tx, SHOP_WORDS) and t10 & {'Management', 'Simulation', 'Life Sim', 'Cozy', 'Time Management', 'Visual Novel', 'Casual'}):
        segs.append('shop_service')
    if has(tx, CARE_WORDS) and (t10 & ANIMAL_TAGS or has(tx, ANIMAL_WORDS)) and t10 & LIFE_ANCHORS \
            and 'Hidden Object' not in set(_names(rec, 3)):
        segs.append('animal_pet')
    if 'Fishing' in t10 or ('Fishing' in t20 and has(tx, FISH_WORDS)):
        segs.append('fishing')
    if 'Desktop Companion' in t20 or \
       (t10 & {'Idler', 'Incremental'} and t10 & {'Relaxing', 'Cozy', 'Cute', 'Life Sim', 'Wholesome'}) or \
       (has(tx, STUDY_WORDS) and t10 & {'Relaxing', 'Cozy', 'Life Sim', 'Idler', 'Wholesome'}):
        segs.append('study_idle')
    if ('Asynchronous Multiplayer' in t20 and t20 & {'Cozy', 'Wholesome', 'Relaxing', 'Life Sim', 'Casual', 'Cute', 'Emotional'}) or \
       (has(tx, ASYNC_WORDS) and t10 & {'Cozy', 'Wholesome', 'Relaxing', 'Life Sim'}):
        segs.append('async_warmth')
    if layers & {'L', 'L2'} and rec.get('relevance_lang') in ('lang_core', 'lang_adjacent'):
        segs.append('language_edu')
    return segs
