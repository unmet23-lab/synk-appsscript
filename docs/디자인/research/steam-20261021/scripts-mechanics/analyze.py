# -*- coding: utf-8 -*-
"""raw 폴더의 Steam 응답으로 게임별 지표와 기능 낱말 묶음 통계를 만든다.
사용: python -I -X utf8 analyze.py <games.json> <raw_dir> <out_dir>
출력: out_dir/stats.json, out_dir/stats.csv, out_dir/groups.csv
"""
import json, sys, re, html, pathlib, datetime, csv, statistics

EN_GROUPS = {
    "npc": r"\b(villagers?|npcs?|residents?|townsfolk|townspeople|towns?people|neighbou?rs?|characters?|zois?|sims|colonists?|dwarves|customers?|guests?)\b",
    "alive": r"\b(alive|lively|living world|feels? (so )?real|lived[- ]in|immersive|immersion)\b",
    "remember_react": r"\b(remembers?|remembered|reacts?|reaction|reacting|notices?|noticed|acknowledg\w*|comments? on|respond\w*)\b",
    "personality": r"\b(personalit(y|ies)|quirk\w*|unique characters?|well[- ]written characters?|charming characters?|lovable|loveable|depth)\b",
    "schedule_autonomy": r"\b(schedules?|routines?|autonom\w*|free will|on their own|daily li(fe|ves)|own lives)\b",
    "relationship": r"\b(relationships?|friendships?|romanc\w*|dating|dateable|marr(y|ied|iage)|heart events?|bond\w*|befriend\w*)\b",
    "gift": r"\b(gifts?|gifting|presents?)\b",
    "festival_event": r"\b(festivals?|events?|celebrations?|holidays?)\b",
    "letter_mail": r"\b(letters?|mail|postcards?)\b",
    "dialogue_repeat": r"(same (lines?|dialogue|things?|conversation)|repetitive dialogue|dialogue (is|gets|becomes|feels) (repetitive|stale)|run(s)? out of (dialogue|things to say)|repeat(s|ing)? (the same|themselves))",
    "repetitive_boring": r"\b(repetitive|repetition|boring|bored|grind\w*|tedious|chores?|monoton\w*|samey)\b",
    "time_gate": r"(time[- ]?gat\w*|real[- ]?time|wait(ing)? (for )?(a |the )?(next )?(day|days|week)|daily (limit|cap|energy)|stamina|energy bar|once (a|per) day)",
    "story": r"\b(story|stories|storytelling|writing|narrative|plot|lore|written)\b",
    "cozy_emotion": r"\b(wholesome|heart ?warming|cozy|cosy|relax\w*|chill|calming|comfort\w*|emotional|cried|tears|cry)\b",
    "learn_language": r"\b(learn\w*|languages?|vocab\w*|words?|grammar|kanji|hiragana|katakana|korean|japanese|stud(y|ying)|educat\w*|fluent|translat\w*|decipher\w*|linguist\w*)\b",
    "empty_soulless": r"\b(empty|soulless|lifeless|dead world|shallow|no depth|lacks? depth|hollow|bland)\b",
    "ai": r"(\bai\b|artificial intelligence|\bllm\b|smart zoi|chat ?gpt|language model)",
    "bugs_perf": r"\b(bugs?|buggy|crash\w*|performance|optimi[sz]\w*|fps|stutter\w*|glitch\w*)\b",
    "price_dlc": r"\b(price|priced|dlcs?|expensive|microtransactions?|overpriced|paywall\w*|monetiz\w*)\b",
    "short_length": r"(too short|short game|\bshort\b|hours? long|\d+ hours? to (beat|finish|complete))",
    "social_online": r"\b(multiplayer|co-?op|online|toxic\w*|trolls?|chat|strangers?|kindness|other players|community)\b",
    "choice_consequence": r"\b(choices?|consequences?|decisions?|matters?|impact)\b",
    "puzzle_deduce": r"\b(puzzles?|deduc\w*|logic|clues?|figure (it )?out|solv\w*|mystery|detective)\b",
    "idle_background": r"(second monitor|while (i|you) (work|study|code|game)|in the background|background|idle|afk|desktop|taskbar)",
    "pet_animal": r"\b(cats?|kitty|kitten|dogs?|pets?|animals?|slimes?|creatures?)\b",
}
KO_GROUPS = {
    "npc": r"(주민|npc|엔피시|엔피씨|마을 ?사람|캐릭터|손님|이웃)",
    "alive": r"(살아 ?있|생동감|생생|몰입)",
    "remember_react": r"(기억|반응|알아 ?봐|알아 ?보)",
    "personality": r"(성격|개성|매력적인 캐릭터|캐릭터들이 매력)",
    "schedule_autonomy": r"(일과|스케줄|스케쥴|자율|알아서|스스로)",
    "relationship": r"(관계|호감|우정|친밀|연애|결혼|친구)",
    "gift": r"(선물)",
    "festival_event": r"(축제|이벤트|행사|명절)",
    "letter_mail": r"(편지|우편)",
    "dialogue_repeat": r"(같은 대사|대사.{0,6}반복|대사가 (적|부족)|똑같은 (말|대사))",
    "repetitive_boring": r"(반복|노가다|지루|단조|귀찮|숙제)",
    "time_gate": r"(기다려야|하루에 (한|하나)|시간 제한|실시간|스태미나|체력)",
    "story": r"(스토리|이야기|서사|내용|각본|대본)",
    "cozy_emotion": r"(힐링|따뜻|따듯|감동|울었|눈물|편안|잔잔|포근|아늑)",
    "learn_language": r"(공부|언어|단어|배우|배웠|한국어|영어|일본어|학습|번역|해독|문법)",
    "empty_soulless": r"(텅 ?빈|공허|영혼이 없|깊이가 없|얕)",
    "ai": r"(ai|인공지능|에이아이|스마트 ?조이)",
    "bugs_perf": r"(버그|최적화|튕|크래시|렉|프레임)",
    "price_dlc": r"(가격|dlc|비싸|과금|현질)",
    "short_length": r"(짧|플레이 ?타임|분량)",
    "social_online": r"(멀티|온라인|채팅|협동|커뮤니티|다른 (플레이어|유저|사람))",
    "choice_consequence": r"(선택|결정|결과)",
    "puzzle_deduce": r"(퍼즐|추리|추론|단서|논리)",
    "idle_background": r"(작업하면서|공부하면서|틀어 ?놓|켜 ?놓|방치|듀얼 ?모니터|배경)",
    "pet_animal": r"(고양이|강아지|펫|동물|슬라임|반려)",
}

def clean(t):
    t = html.unescape(t or "")
    t = re.sub(r"\[/?[a-z0-9*]+(=[^\]]*)?\]", " ", t)  # BBCode
    return re.sub(r"\s+", " ", t).strip()

def load_reviews(raw, appid, lang):
    out, seen = [], set()
    for fp in sorted((raw / "reviews").glob(f"{appid}_{lang}_p*.json"), key=lambda p: int(p.stem.split("_p")[-1])):
        d = json.loads(fp.read_text(encoding="utf-8"))
        for r in d.get("reviews", []) or []:
            rid = r.get("recommendationid")
            if rid in seen: continue
            seen.add(rid)
            out.append(r)
    return out

def store_rows(raw, appid):
    fp = raw / "store" / f"{appid}.html"
    res = {}
    if not fp.exists(): return res
    h = fp.read_bytes().decode("utf-8", "replace")
    tips = re.findall(r'data-tooltip-html="([^"]*)"', h)
    for t in tips:
        t2 = html.unescape(t)
        if "last 30 days" in t2 and "recent" not in res: res["recent"] = t2
        elif "in your language" in t2 and "lang" not in res: res["lang"] = t2
        elif "for this game are positive" in t2 and "all" not in res: res["all"] = t2
    m = re.search(r'Recent Reviews:</div>\s*<div class="summary column">\s*<span class="game_review_summary [^"]*"[^>]*>([^<]*)<', h)
    if m: res["recent_desc"] = m.group(1)
    m = re.search(r'<div class="subtitle column all">All Reviews:</div>\s*<div class="summary column">\s*<span class="game_review_summary [^"]*"[^>]*>([^<]*)<', h)
    if m: res["all_desc"] = m.group(1)
    if "No user reviews" in h and not res: res["note"] = "no user reviews"
    return res

def ts(x):
    return datetime.datetime.fromtimestamp(x, datetime.timezone.utc).strftime("%Y-%m-%d")

def group_stats(revs, groups):
    rows = {}
    n = len(revs)
    for g, pat in groups.items():
        rx = re.compile(pat, re.I)
        hit = [r for r in revs if rx.search(clean(r.get("review", "")))]
        pos = sum(1 for r in hit if r.get("voted_up"))
        rows[g] = {"n": len(hit), "share": round(len(hit) / n, 3) if n else None,
                   "pos": pos, "neg": len(hit) - pos,
                   "pos_rate": round(pos / len(hit), 3) if hit else None}
    return rows

def main():
    games = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    raw = pathlib.Path(sys.argv[2]); out = pathlib.Path(sys.argv[3]); out.mkdir(exist_ok=True)
    allstats = []
    for g in games:
        appid = g["appid"]
        st = {"appid": appid, "name": g["name"], "lens": g["lens"]}
        dfp = raw / "details" / f"{appid}.json"
        if dfp.exists():
            try:
                d = json.loads(dfp.read_text(encoding="utf-8"))[str(appid)]
                if d.get("success"):
                    dd = d["data"]
                    st["store_name"] = dd.get("name")
                    st["release"] = dd.get("release_date", {}).get("date")
                    st["coming_soon"] = dd.get("release_date", {}).get("coming_soon")
                    st["early_access"] = any(x.get("id") == "70" or x.get("description") == "Early Access" for x in dd.get("genres", []) or [])
                    st["korean_ui"] = "Korean" in (dd.get("supported_languages") or "")
                    st["price"] = (dd.get("price_overview") or {}).get("final_formatted") or ("Free" if dd.get("is_free") else None)
                    st["short_desc"] = clean(dd.get("short_description"))
                    st["developers"] = dd.get("developers")
            except Exception as e:
                st["details_err"] = repr(e)
        for lang in ("all", "english", "koreana"):
            sfp = raw / "summary" / f"{appid}_{lang}.json"
            if sfp.exists():
                try:
                    q = json.loads(sfp.read_text(encoding="utf-8")).get("query_summary", {})
                    tot = q.get("total_reviews") or 0
                    st[f"sum_{lang}"] = {"total": tot, "pos": q.get("total_positive"), "neg": q.get("total_negative"),
                                         "pos_rate": round(q.get("total_positive", 0) / tot, 4) if tot else None,
                                         "desc": q.get("review_score_desc")}
                except Exception as e:
                    st[f"sum_{lang}_err"] = repr(e)
        st["store_rows"] = store_rows(raw, appid)
        for lang, groups in (("english", EN_GROUPS), ("koreana", KO_GROUPS)):
            revs = load_reviews(raw, appid, lang)
            if not revs:
                st[f"sample_{lang}"] = {"n": 0}
                continue
            tsl = [r["timestamp_created"] for r in revs]
            pos = sum(1 for r in revs if r.get("voted_up"))
            pt = [r.get("author", {}).get("playtime_at_review", 0) / 60 for r in revs]
            st[f"sample_{lang}"] = {"n": len(revs), "from": ts(min(tsl)), "to": ts(max(tsl)), "pos": pos,
                                    "pos_rate": round(pos / len(revs), 3),
                                    "median_playtime_h": round(statistics.median(pt), 1),
                                    "median_len_chars": int(statistics.median(len(clean(r.get('review',''))) for r in revs))}
            st[f"groups_{lang}"] = group_stats(revs, groups)
        allstats.append(st)
        print(appid, g["name"], st.get("sum_all", {}).get("total"), st.get("sample_english", {}).get("n"), st.get("sample_koreana", {}).get("n"), flush=True)
    (out / "stats.json").write_text(json.dumps(allstats, ensure_ascii=False, indent=1), encoding="utf-8")
    with open(out / "stats.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["appid", "name", "lens", "release", "EA", "korean_ui", "all_total", "all_pos_rate", "all_desc", "recent_desc", "recent_tip",
                    "en_n", "en_from", "en_to", "en_pos_rate", "en_med_play_h", "ko_n", "ko_from", "ko_to", "ko_pos_rate", "ko_all_total", "ko_all_pos_rate"])
        for s in allstats:
            sa = s.get("sum_all", {}); se = s.get("sample_english", {}); sk = s.get("sample_koreana", {}); sko = s.get("sum_koreana", {})
            w.writerow([s["appid"], s["name"], "/".join(map(str, s["lens"])), s.get("release"), s.get("early_access"), s.get("korean_ui"),
                        sa.get("total"), sa.get("pos_rate"), sa.get("desc"), s["store_rows"].get("recent_desc"), s["store_rows"].get("recent"),
                        se.get("n"), se.get("from"), se.get("to"), se.get("pos_rate"), se.get("median_playtime_h"),
                        sk.get("n"), sk.get("from"), sk.get("to"), sk.get("pos_rate"), sko.get("total"), sko.get("pos_rate")])
    with open(out / "groups.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["appid", "name", "lang", "group", "n", "share", "pos", "neg", "pos_rate", "sample_pos_rate"])
        for s in allstats:
            for lang in ("english", "koreana"):
                for gname, gr in (s.get(f"groups_{lang}") or {}).items():
                    w.writerow([s["appid"], s["name"], lang, gname, gr["n"], gr["share"], gr["pos"], gr["neg"], gr["pos_rate"], s.get(f"sample_{lang}", {}).get("pos_rate")])

if __name__ == "__main__":
    main()
