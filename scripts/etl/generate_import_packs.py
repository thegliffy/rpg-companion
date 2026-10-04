#!/usr/bin/env python3
"""Generate bulk-import JSON packs from the 5etools data mirror for the books on the shelf.

Outputs {system, items: [{type, name, data}]} packs in the shape the app's
POST /api/custom-content/import endpoint expects, chunked to that route's 200-row cap.
Every row is emitted through the app's own zod schemas by validate_packs.mjs afterwards.

Only content types the app has custom-content schemas for are emitted
(race, subrace, class, subclass, background, feat, spell, item, monster).
"""
import json, os, re, sys, glob, copy, collections

DATA = os.path.expanduser("~/work/5etools-src/data")
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../import-packs"))

# Books on the shelf (Grimlib), mapped to 5etools source codes.
SHELF = ["PHB","MM","DMG","SCAG","VGM","XGE","MTF","GGR","ERLW","EGW","TCE","MOT",
         "VRGR","AI","SCC","MPMM","FTD","BGG","BMT","EFA","FRHoF","RHW","AAG","BAM",
         "LMoP","ToA"]
SHELF_SET = set(SHELF)

# ---------------------------------------------------------------- helpers ----
TAG_RE = re.compile(r"\{@(\w+)(?:\s+([^}]*))?\}")
def strip_tags(s):
    if not isinstance(s, str):
        return s
    def rep(m):
        tag, inner = m.group(1), m.group(2)
        if inner:
            return inner
        return {"hit": "", "d": "", "atk": "", "h": "", "condition": ""}.get(tag, tag.capitalize()) or ""
    out = TAG_RE.sub(rep, s)
    return re.sub(r"\s{2,}", " ", out).strip()

def flatten_entries(entries, max_depth=6):
    """5etools entries are lists of strings/dicts (type:list/type:entries/etc.) — flatten to text."""
    if entries is None:
        return []
    if isinstance(entries, str):
        return [strip_tags(entries)]
    if not isinstance(entries, list) or max_depth <= 0:
        return []
    out = []
    for e in entries:
        if isinstance(e, str):
            out.append(strip_tags(e))
        elif isinstance(e, dict):
            t = e.get("type")
            if t in ("entries", "list", "item", "glossentry"):
                if e.get("name"):
                    out.append(strip_tags(e["name"]))
                out.extend(flatten_entries(e.get("entries", e.get("items")), max_depth - 1))
            elif t == "dice":
                pass
            elif e.get("name"):
                out.append(strip_tags(e["name"]))
                out.extend(flatten_entries(e.get("entries"), max_depth - 1))
    return out

def join_desc(entries, cap):
    return "\n".join(flatten_entries(entries))[:cap]

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def load(p):
    with open(p) as f:
        return json.load(f)

def entries_of(d, key=None):
    if isinstance(d, list):
        return d
    if key and key in d:
        return d[key]
    for v in d.values():
        if isinstance(v, list):
            return v
    return []

# ------------------------------------------------------- _copy resolution ----
def deep_merge(base, over):
    out = copy.deepcopy(base)
    for k, v in over.items():
        if k == "_mod" or k == "_cond":
            continue
        out[k] = copy.deepcopy(v)
    return out

def apply_mod(resolved, mod):
    for key, ops in mod.items():
        if not isinstance(ops, list):
            continue
        for op in ops:
            if not isinstance(op, dict):
                continue
            if "replaceArr" in op:
                idx, val = op.get("index", 0), op.get("val")
                arr = resolved.get(key, [])
                if isinstance(arr, list) and isinstance(val, list):
                    arr = arr[:idx] + copy.deepcopy(val) + arr[idx:]
                    resolved[key] = arr
            elif "appendArr" in op:
                arr = resolved.setdefault(key, [])
                if isinstance(arr, list):
                    arr.extend(copy.deepcopy(op.get("val", [])))
            elif "removeArr" in op:
                arr = resolved.get(key, [])
                idx = op.get("index")
                if isinstance(arr, list) and idx is not None and 0 <= idx < len(arr):
                    arr.pop(idx)
            elif "add" in op:
                arr = resolved.setdefault(key, [])
                if isinstance(arr, list):
                    arr.append(op["add"])
    return resolved

def resolve_copies(entries, index):
    """Resolve {_copy: {name, source, _mod}} clones against a global name|source index."""
    out = []
    for e in entries:
        if not isinstance(e, dict):
            continue
        if "_copy" in e and isinstance(e["_copy"], dict):
            base_name = e["_copy"].get("name", "")
            base_src = e["_copy"].get("source", "")
            key = f"{base_name.lower()}|{base_src.lower()}"
            base = index.get(key)
            if base is None:
                base = index.get(base_name.lower())
            if base is None:
                continue  # unresolvable clone — drop it
            mod = e["_copy"].get("_mod") or {}
            r = deep_merge(base, {k: v for k, v in e.items() if k != "_copy"})
            if mod:
                r = apply_mod(r, mod)
            out.append(r)
        else:
            out.append(e)
    return out

def build_index(paths, key=None):
    idx = {}
    for p in paths:
        for e in entries_of(load(p), key):
            if isinstance(e, dict) and e.get("name") and "_copy" not in e:
                idx[f"{e['name'].lower()}|{str(e.get('source','')).lower()}"] = e
                idx.setdefault(e["name"].lower(), e)
    return idx

# ------------------------------------------------------------ lookup maps ----
SCHOOL = {"A":"Abjuration","V":"Conjuration","E":"Divination","I":"Enchantment",
          "N":"Evocation","T":"Illusion","R":"Necromancy","W":"Transmutation","M":""}
SIZE = {"T":"Tiny","S":"Small","M":"Medium","L":"Large","H":"Huge","G":"Gargantuan"}
ALIGN = {"L":"lawful good","N":"neutral","C":"chaotic evil","G":"good","E":"evil",
         "LG":"lawful good","NG":"neutral good","CG":"chaotic good","LN":"lawful neutral",
         "TN":"true neutral","CN":"chaotic neutral","LE":"lawful evil","NE":"neutral evil",
         "CE":"chaotic evil","U":"unaligned","A":"chaotic evil"}
XP = {"0":10,"1/8":25,"1/4":50,"1/2":100,"1":200,"2":450,"3":600,"4":1100,"5":1800,
      "6":2300,"7":2900,"8":3900,"9":5000,"10":5900,"11":7200,"12":8400,"13":10000,
      "14":11500,"15":13000,"16":15000,"17":18000,"18":20000,"19":22000,"20":28000,
      "21":33000,"22":41000,"23":50000,"24":62000,"25":75000,"26":95000,"27":105000,
      "28":135000,"29":155000,"30":155000}
ABILITIES = {"str","dex","con","int","wis","cha"}
SKILLS = {"acrobatics","animal handling","arcana","athletics","deception","history",
          "insight","intimidation","investigation","medicine","nature","perception",
          "performance","persuasion","religion","sleight of hand","stealth","survival"}
SKILL_ID = {s: s.replace(" ", "-") for s in SKILLS}
ABILITY_WORDS = {"strength":"str","dexterity":"dex","constitution":"con","intelligence":"int",
                 "wisdom":"wis","charisma":"cha"}

def gp(str_or_num):
    if isinstance(str_or_num, (int, float)):
        return float(str_or_num)
    m = re.match(r"^(\d+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)$", str(str_or_num).strip().lower())
    if not m:
        return 0.0
    v = float(m.group(1)); u = m.group(2)
    return {"gp":1,"pp":10,"ep":0.5,"sp":0.1,"cp":0.01}[u] * v

def parse_int(v, lo, hi, default=None):
    if isinstance(v, (int, float)):
        return clamp(int(v), lo, hi)
    if isinstance(v, str):
        m = re.search(r"-?\d+", v)
        if m:
            return clamp(int(m.group()), lo, hi)
    return default

# --------------------------------------------------------------- spells ----
def cast_time(t):
    if isinstance(t, str):
        return strip_tags(t)[:120]
    if isinstance(t, list) and t:
        t0 = t[0]
        if isinstance(t0, dict):
            unit = t0.get("unit", "action")
            n = t0.get("number", 1)
            if unit == "action":
                s = "action" if n == 1 else f"{n} actions"
            elif unit == "reaction":
                cond = t0.get("condition", "")
                s = "reaction" + (f", {strip_tags(cond)}" if cond else "")
            else:
                s = f"{n} {unit}" + ("" if n == 1 else "s")
            return s[:120]
        return strip_tags(str(t0))[:120]
    return ""

def spell_range(r):
    if isinstance(r, str):
        return strip_tags(r)[:60]
    if isinstance(r, dict):
        ty = r.get("type", "")
        if ty == "point":
            d = r.get("distance", {})
            amt = d.get("amount"); unit = d.get("type", "feet")
            if amt is None:
                return "Special"
            return f"{amt} {unit[:-1] if unit.endswith('s') else unit}."[:60]
        if ty == "touch":
            return "Touch"
        if ty == "self":
            special = r.get("special")
            return (strip_tags(special) if special else "Self")[:60]
        if ty == "sight":
            return "Sight"
        if ty == "special":
            return strip_tags(r.get("special", "Special"))[:60]
        return strip_tags(ty)[:60]
    return ""

def spell_duration(d):
    if isinstance(d, str):
        return strip_tags(d)[:60]
    if isinstance(d, list) and d:
        parts = []
        for seg in d:
            if isinstance(seg, dict):
                if seg.get("type") == "instant":
                    parts.append("Instantaneous")
                elif seg.get("type") == "concentration":
                    parts.append("Concentration")
                elif seg.get("type") == "timed":
                    t = seg.get("duration", {})
                    parts.append(f"up to {t.get('amount')} {t.get('unit','minute')}" + ("" if t.get('amount')==1 else "s"))
                elif seg.get("type") == "special":
                    parts.append(strip_tags(seg.get("duration", "Special")))
                elif seg.get("until"):
                    parts.append(strip_tags(seg["until"]))
            elif isinstance(seg, str):
                parts.append(strip_tags(seg))
        s = ", ".join(p for p in parts if p)
        return (s if s else "Instantaneous")[:60]
    return "Instantaneous"

def spell_components(c):
    out = {"verbal": False, "somatic": False, "material": False,
           "materialConsumed": False, "materialCost": ""}
    if isinstance(c, dict):
        out["verbal"] = bool(c.get("v"))
        out["somatic"] = bool(c.get("s"))
        m = c.get("m")
        if m:
            out["material"] = True
            if isinstance(m, str):
                out["materialCost"] = strip_tags(m)[:120]
        out["materialConsumed"] = bool(c.get("r"))
    return out

def map_spell(x):
    d = {"description": join_desc(x.get("entries"), 4000),
         "level": int(x.get("level", 0)),
         "school": SCHOOL.get(str(x.get("school", "")), str(x.get("school", "")))[:30],
         "castingTime": cast_time(x.get("time")),
         "range": spell_range(x.get("range")),
         "duration": spell_duration(x.get("duration")),
         "requiresAttackRoll": bool(re.search(r"\{@atk|\{@h}", json.dumps(x.get("entries", [])))),
         "components": spell_components(x.get("components")),
         "saveEffect": "none", "conditionImposed": "", "areaOfEffect": "",
         "ritual": bool((x.get("meta") or {}).get("ritual")),
         "concentration": bool((x.get("meta") or {}).get("concentration"))
                           or "concentration" in json.dumps(x.get("duration", "")),
         "classes": sorted({str(c).lower() for c in (x.get("classes") or []) if isinstance(c, str)})[:12],
         "scalingDicePerLevel": "", "scalingNote": ""}
    txt = json.dumps(x.get("entries", []))
    m = re.search(r"\{@damage ([\dd+\- ]+)\}\s*(\w+)?", txt)
    if m:
        d["damageDice"] = m.group(1).strip()[:30]
        if m.group(2) and m.group(2).lower() in ("acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"):
            d["damageType"] = m.group(2).lower()
    m = re.search(r"DC \d+ (strength|dexterity|constitution|intelligence|wisdom|charisma) saving throw", txt, re.I)
    if m:
        d["saveAbility"] = ABILITY_WORDS[m.group(1).lower()]
    hl = re.search(r"[Aa]t [Hh]igher [Ll]evels?[.:]? ([^\"|]+)", txt)
    if hl:
        note = strip_tags(hl.group(1)).strip()
        md = re.search(r"\{@damage ([\dd+\- ]+)\}", note)
        if md:
            d["scalingDicePerLevel"] = md.group(1).strip()[:20]
        if note:
            d["scalingNote"] = note[:300]
    return d

# ---------------------------------------------------------------- feats ----
def map_feat(x):
    d = {"description": join_desc(x.get("entries"), 2000),
         "abilityBonuses": {}, "skillProficiencies": [],
         "grantedSpells": [], "spellChoices": [], "prereqAbility": {},
         "prereqLevel": 0, "prereqText": ""}
    ab = x.get("ability")
    if isinstance(ab, list):
        for a in ab:
            if isinstance(a, dict):
                for k, v in a.items():
                    if k in ABILITIES and isinstance(v, int):
                        d["abilityBonuses"][k] = clamp(v, -10, 10)
    sp = x.get("skillProficiencies")
    if isinstance(sp, list):
        for s in sp:
            if isinstance(s, dict):
                for k in s:
                    if k in SKILLS:
                        d["skillProficiencies"].append(SKILL_ID[k])
            elif isinstance(s, str) and s.lower() in SKILLS:
                d["skillProficiencies"].append(SKILL_ID[s.lower()])
        d["skillProficiencies"] = d["skillProficiencies"][:18]
    pre = x.get("prerequisite")
    if isinstance(pre, list):
        texts = []
        for p in pre:
            if isinstance(p, dict):
                if "ability" in p and isinstance(p["ability"], dict):
                    for k, v in p["ability"].items():
                        if k in ABILITIES and isinstance(v, int):
                            d["prereqAbility"][k] = clamp(v, 1, 30)
                elif "level" in p and isinstance(p["level"], dict) and "min" in p["level"]:
                    d["prereqLevel"] = clamp(int(p["level"]["min"]), 0, 20)
                else:
                    texts.append(json.dumps(p)[:120])
            elif isinstance(p, str):
                texts.append(strip_tags(p))
        d["prereqText"] = "; ".join(texts)[:120]
    return d

# ---------------------------------------------------------- backgrounds ----
def map_background(x):
    d = {"skills": {"fixed": [], "choices": []},
         "tools": {"fixed": [], "choices": []},
         "languages": {"fixed": [], "anyCount": 0},
         "equipment": {"items": [], "gold": 0, "startingCurrency": {"gp": 0}},
         "features": [], "variantTables": []}
    for sp in x.get("skillProficiencies", []) or []:
        if isinstance(sp, dict):
            for k, v in sp.items():
                if k in SKILLS and v is True:
                    d["skills"]["fixed"].append(SKILL_ID[k])
                elif k.startswith("any"):
                    n = v if isinstance(v, int) else 1
                    d["skills"]["choices"].append({"count": clamp(n,1,6), "from": {"kind": "any"}})
    for tp in x.get("toolProficiencies", []) or []:
        if isinstance(tp, dict):
            for k, v in tp.items():
                if k.startswith("any"):
                    n = v if isinstance(v, int) else 1
                    d["tools"]["choices"].append({"count": clamp(n,1,10), "from": [k][:20]})
                else:
                    d["tools"]["fixed"].append(strip_tags(k)[:40])
    for lp in x.get("languageProficiencies", []) or []:
        if isinstance(lp, dict):
            for k, v in lp.items():
                if k.startswith("any"):
                    d["languages"]["anyCount"] += clamp(v if isinstance(v, int) else 1, 0, 10)
                else:
                    d["languages"]["fixed"].append(strip_tags(k)[:40])
    d["skills"]["fixed"] = d["skills"]["fixed"][:18]
    d["skills"]["choices"] = d["skills"]["choices"][:5]
    d["tools"]["fixed"] = d["tools"]["fixed"][:20]
    d["tools"]["choices"] = d["tools"]["choices"][:5]
    d["languages"]["fixed"] = d["languages"]["fixed"][:10]
    d["languages"]["anyCount"] = clamp(d["languages"]["anyCount"], 0, 10)
    se = x.get("startingEquipment")
    if isinstance(se, list):
        for grp in se:
            if not isinstance(grp, dict):
                continue
            for key, items in grp.items():
                if not isinstance(items, list):
                    continue
                label = "" if key == "_" else f" (choose one: {key})"
                for it in items:
                    if isinstance(it, dict):
                        nm = strip_tags(it.get("displayName") or it.get("special") or it.get("item", ""))
                        q = it.get("quantity", 1)
                        if it.get("containsValue"):
                            gpv = it["containsValue"] / 100.0
                            d["equipment"]["startingCurrency"]["gp"] = clamp(d["equipment"]["startingCurrency"]["gp"] + gpv, 0, 9999)
                        if nm:
                            d["equipment"]["items"].append((f"{q}x " if q != 1 else "") + nm + label)
                    elif isinstance(it, str):
                        d["equipment"]["items"].append(strip_tags(it) + label)
        d["equipment"]["items"] = [i[:200] for i in d["equipment"]["items"][:20]]
    feats = x.get("feature") or x.get("features")
    if isinstance(feats, dict):
        feats = [feats]
    if isinstance(feats, list):
        for i, f in enumerate(feats[:5]):
            if isinstance(f, dict) and f.get("name"):
                d["features"].append({"id": f"bgfeat{i+1}", "name": strip_tags(f["name"])[:60],
                                      "description": join_desc(f.get("entries"), 500)})
    return d

# ------------------------------------------------------- races/subraces ----
def ability_score_increase(x):
    out = {}
    asi = x.get("ability") or x.get("abilityScoreIncrease")
    if isinstance(asi, dict):
        for k, v in asi.items():
            if k in ABILITIES and isinstance(v, int):
                out[k] = clamp(v, -4, 4)
    elif isinstance(asi, list):
        for a in asi:
            if isinstance(a, dict):
                for k, v in a.items():
                    if k in ABILITIES and isinstance(v, int):
                        out[k] = clamp(v, -4, 4)
    return out

def race_speed(x):
    sp = x.get("speed")
    if isinstance(sp, dict):
        return clamp(parse_int(sp.get("walk"), 0, 200, 30), 0, 200)
    if isinstance(sp, (int, float)):
        return clamp(int(sp), 0, 200)
    return 30

def race_languages(x):
    out = []
    for lp in x.get("languageProficiencies", []) or []:
        if isinstance(lp, dict):
            for k in lp:
                if not k.startswith("any"):
                    out.append(strip_tags(k)[:40])
        elif isinstance(lp, str):
            out.append(strip_tags(lp)[:40])
    return out[:20]

def race_traits(x):
    out = []
    tr = x.get("trait")
    if isinstance(tr, list):
        for i, t in enumerate(tr[:20]):
            if isinstance(t, str):
                out.append({"id": f"trait{i+1}", "name": strip_tags(t)[:60]})
            elif isinstance(t, dict) and t.get("name"):
                entry = {"id": f"trait{i+1}", "name": strip_tags(t["name"])[:60],
                         "description": join_desc(t.get("entries"), 1000)}
                if t.get("darkvision"):
                    entry["darkvisionFeet"] = clamp(parse_int(t["darkvision"], 0, 300, 0), 0, 300)
                if t.get("damageResistances"):
                    entry["damageResistances"] = [str(r)[:30] for r in t["damageResistances"][:10] if isinstance(r, str)]
                for k, fld in (("climb","climbSpeed"),("swim","swimSpeed"),("fly","flySpeed"),("burrow","burrowSpeed")):
                    if t.get("speed") and isinstance(t["speed"], dict) and k in t["speed"]:
                        entry[fld] = clamp(parse_int(t["speed"][k], 0, 200, 0), 0, 200)
                out.append(entry)
    if not out and x.get("darkvision"):
        out.append({"id": "trait1", "name": "Darkvision", "darkvisionFeet": clamp(parse_int(x["darkvision"], 0, 300, 0), 0, 300)})
    return out[:20]

def map_race(x):
    return {"abilityBonuses": ability_score_increase(x),
            "abilityBonusChoices": [],
            "speed": race_speed(x),
            "size": SIZE.get(str(x.get("size","M")) if isinstance(x.get("size"), str) else "M", "Medium")[:20],
            "languages": race_languages(x),
            "traits": race_traits(x)}

def map_subrace(x, parent):
    d = {"parentRace": parent[:60],
         "abilityBonuses": ability_score_increase(x),
         "speed": 0,
         "traits": race_traits(x)}
    return d

# --------------------------------------------------------------- classes ----
CASTER_TYPE = {"full":"prepared","half":"prepared","third":"prepared","pact":"pact"}

def map_class(x, class_features_by_name):
    hd = x.get("hd", {})
    faces = hd.get("faces") if isinstance(hd, dict) else None
    if faces not in (6, 8, 10, 12):
        return None
    prog = str(x.get("casterProgression", ""))
    caster = "none"
    if prog in ("full","half","third"):
        caster = "pact" if x.get("name","").lower() == "warlock" else "prepared"
    if x.get("spellsKnownProgression") or x.get("spellsKnownProgressionFixed"):
        caster = "pact" if x.get("name","").lower() == "warlock" else "known"
    levels = []
    ct = x.get("cantripProgression") or []
    sk = x.get("spellsKnownProgression") or x.get("spellsKnownProgressionFixed") or []
    slots = x.get("spellslotsProgression") or {}
    for lvl in range(1, 21):
        e = {"level": lvl}
        if ct and len(ct) >= lvl and ct[lvl-1]:
            e["cantripsKnown"] = clamp(int(ct[lvl-1]), 0, 20)
        if sk and len(sk) >= lvl and sk[lvl-1]:
            e["spellsKnown"] = clamp(int(sk[lvl-1]), 0, 40)
        if slots:
            s = {}
            for k, v in slots.items():
                try:
                    s[str(int(k))] = clamp(int(v), 0, 20)
                except (ValueError, TypeError):
                    continue
            if s:
                e["slots"] = s
        feats = class_features_by_name.get(x["name"].lower(), {}).get(lvl, [])
        if feats:
            e["features"] = feats[:10]
        levels.append(e)
    return {"hitDie": faces, "casterType": caster, "levels": levels,
            "resources": [], "startingEquipment": {"fixed": [], "choices": []}}

def map_subclass(x, class_name, optfeatures_index):
    d = {"parentClass": class_name[:60], "levels": [], "features": [], "spells": [], "resources": []}
    seen_levels = {}
    for lvl in range(1, 21):
        names = []
        for fname in x.get("subclassFeature", []) or []:
            key = f"{fname.lower()}|{str(x.get('source','')).lower()}"
            of = optfeatures_index.get(key) or optfeatures_index.get(fname.lower())
            if of and isinstance(of.get("level"), int) and of["level"] == lvl:
                names.append(strip_tags(fname)[:60])
        if names:
            d["levels"].append({"level": lvl, "features": names[:10]})
    for i, fname in enumerate(x.get("subclassFeature", []) or []):
        key = f"{fname.lower()}|{str(x.get('source','')).lower()}"
        of = optfeatures_index.get(key) or optfeatures_index.get(fname.lower())
        if not of:
            continue
        lvl = of.get("level", 3)
        if not isinstance(lvl, int):
            continue
        d["features"].append({"id": f"scfeat{i+1}", "level": clamp(lvl, 1, 20),
                              "name": strip_tags(of["name"])[:60],
                              "description": join_desc(of.get("entries"), 1000),
                              "armorProficiencies": [], "weaponProficiencies": [], "toolProficiencies": []})
    d["features"] = d["features"][:30]
    return d

# ----------------------------------------------------------------- items ----
ITEM_TYPE = {"W":"weapon","R":"weapon","A":"armor","LA":"armor","MA":"armor","HA":"armor",
             "S":"armor","G":"gear","F":"gear","AD":"gear","INS":"gear","O":"gear","G-F":"gear"}
ARMOR_CAT = {"LA":"light","MA":"medium","HA":"heavy","S":"shield","A":"medium"}
RARITY = {"common":"common","uncommon":"uncommon","rare":"rare","very rare":"very rare",
          "rare (requires attunement)": "rare", "artifact":"artifact"}

def map_item_base(x):
    t = str(x.get("type", "G"))
    kind = ITEM_TYPE.get(t, "gear")
    d = {"description": join_desc(x.get("entries"), 4000), "kind": kind,
         "weight": float(x.get("weight", 0) or 0), "value": gp(x.get("cost", 0)),
         "damageDice": "", "damageType": "", "properties": [],
         "baseAC": 0, "dexBonus": False, "stealthDisadvantage": False,
         "armorCategory": "medium", "category": "", "rarity": "",
         "abilityBonuses": {}, "abilityScoreSetTo": {}, "acBonus": 0, "saveBonus": 0,
         "magicBonus": 0, "requiresAttunement": False, "grantedResistances": [],
         "toggledEffect": {}, "maxCharges": 0, "chargeCost": 1, "chargeRecharge": "long"}
    if kind == "weapon":
        dmg = x.get("damage")
        if isinstance(dmg, list) and dmg and isinstance(dmg[0], dict):
            d["damageDice"] = str(dmg[0].get("damageDice", ""))[:30]
            dt = str(dmg[0].get("damageType", ""))
            if dt:
                d["damageType"] = dt[:30]
        d["properties"] = [str(p)[:40] for p in (x.get("properties") or [])[:10]]
        d["category"] = ("martial melee weapon" if t == "W" else "ranged weapon")[:60]
    elif kind == "armor":
        d["armorCategory"] = ARMOR_CAT.get(t, "medium")
        ac = x.get("ac")
        if isinstance(ac, dict):
            d["baseAC"] = clamp(parse_int(ac.get("base"), 0, 30, 0) or 0, 0, 30)
            d["dexBonus"] = bool(ac.get("dex"))
            if ac.get("max") is not None:
                d["maxDexBonus"] = clamp(parse_int(ac["max"], 0, 10, 10), 0, 10)
            d["stealthDisadvantage"] = bool(ac.get("stealth"))
        d["category"] = {"light":"light armor","medium":"medium armor","heavy":"heavy armor","shield":"shield"}[d["armorCategory"]][:60]
    return d

def map_item_magic(x):
    d = {"description": join_desc(x.get("entries"), 4000), "kind": "magic",
         "weight": float(x.get("weight", 0) or 0), "value": gp(x.get("cost", 0)),
         "damageDice": "", "damageType": "", "properties": [],
         "baseAC": 0, "dexBonus": False, "stealthDisadvantage": False,
         "armorCategory": "medium", "category": "", "rarity": "",
         "abilityBonuses": {}, "abilityScoreSetTo": {}, "acBonus": 0, "saveBonus": 0,
         "magicBonus": 0, "requiresAttunement": False, "grantedResistances": [],
         "toggledEffect": {}, "maxCharges": 0, "chargeCost": 1, "chargeRecharge": "long"}
    t = str(x.get("type", "")).split("|")[0]
    d["category"] = {"RD":"rod","RG":"ring","RO":"rod","SC":"potion","POT":"potion","WON":"wondrous item",
                     "WAND":"wand","ST":"staff","SWORD":"weapon","RNG":"ring","AMU":"wondrous item",
                     "ARM":"armor","SHLD":"shield","TOOL":"tool","INSTR":"instrument"}.get(t, "wondrous item")[:60]
    r = str(x.get("rarity", ""))
    d["rarity"] = RARITY.get(r, r)[:30]
    d["requiresAttunement"] = bool(x.get("reqAttune"))
    m = re.match(r"\+(\d)", x["name"])
    if m:
        d["magicBonus"] = clamp(int(m.group(1)), -5, 5)
    if x.get("bonusAC"):
        d["acBonus"] = clamp(parse_int(x["bonusAC"], -10, 10, 0) or 0, -10, 10)
    if x.get("bonusSpellAttack"):
        d["toggledEffect"] = {}  # spell attack bonus has no static field on items; keep in description
    return d

# -------------------------------------------------------------- monsters ----
def parse_senses(x, d):
    for s in x.get("senses", []) or []:
        if not isinstance(s, str):
            continue
        m = re.search(r"(darkvision|blindsight|tremorsense|truesight)\s*(\d+)?", s, re.I)
        if m:
            key = m.group(1).lower()
            rng = parse_int(m.group(2), 0, 240, 0) if m.group(2) else 0
            d[key] = max(d.get(key, 0), rng)
    return d

def flat_strings(lst, cap_len, cap_n):
    out = []
    for it in lst or []:
        if isinstance(it, str):
            out.append(strip_tags(it)[:cap_len])
        elif isinstance(it, dict):
            v = it.get("damageType") or it.get("condition") or it.get("special")
            if isinstance(v, str):
                out.append(strip_tags(v)[:cap_len])
    return out[:cap_n]

def monster_skills(x):
    out = []
    sk = x.get("skill")
    if isinstance(sk, dict):
        for k, v in sk.items():
            b = parse_int(v, -5, 20, None)
            if b is not None:
                out.append({"name": strip_tags(k)[:30], "bonus": b})
    elif isinstance(sk, list):
        for s in sk:
            if isinstance(s, dict):
                for k, v in s.items():
                    b = parse_int(v, -5, 20, None)
                    if b is not None:
                        out.append({"name": strip_tags(k)[:30], "bonus": b})
    return out[:10]

ATK_RE = re.compile(r"\{@hit (-?\d+)\}")
DMG_RE = re.compile(r"\{@damage ([\dd+\- ]+)\}\s*([a-z]+)?")

def parse_attack(entries):
    txt = " ".join(flatten_entries(entries))
    ab = ATK_RE.search(json.dumps(entries))
    dd = DMG_RE.search(json.dumps(entries))
    return ab, dd, txt

def map_monster(x):
    d = {"size": SIZE.get(str(x.get("size","M")) if isinstance(x.get("size"), str) else "M", "Medium")[:20],
         "type": str(x.get("type","beast"))[:30],
         "alignment": "",
         "cr": 0.0, "xp": 10, "ac": 10, "hp": 1, "hitDice": "",
         "speed": {}, "str": 10, "dex": 10, "con": 10, "int": 10, "wis": 10, "cha": 10,
         "passivePerception": 10, "languages": "",
         "damageVulnerabilities": [], "damageResistances": [], "damageImmunities": [],
         "conditionImmunities": [], "skills": [], "specialAbilities": [],
         "actions": [], "legendaryActions": [], "legendaryActionsPerRound": 3}
    al = x.get("alignment", ["U"])
    if isinstance(al, str):
        al = [al]
    parts = [ALIGN.get(str(a), str(a)) for a in al if a]
    d["alignment"] = " ".join(p for p in parts if p)[:40] or "unaligned"
    cr = str(x.get("cr", "0"))
    if cr in XP:
        d["cr"] = float(eval(cr)) if "/" in cr else float(cr)
        d["xp"] = XP[cr]
    else:
        try:
            d["cr"] = float(cr)
            d["xp"] = XP.get(cr, 0)
        except ValueError:
            return None
    ac = x.get("ac")
    if isinstance(ac, list) and ac:
        a0 = ac[0]
        if isinstance(a0, dict):
            d["ac"] = clamp(parse_int(a0.get("ac"), 0, 30, 10) or 10, 0, 30)
        elif isinstance(a0, (int, float)):
            d["ac"] = clamp(int(a0), 0, 30)
    elif isinstance(ac, (int, float)):
        d["ac"] = clamp(int(ac), 0, 30)
    hp = x.get("hp")
    if isinstance(hp, dict):
        if hp.get("special"):
            v = parse_int(str(hp["special"]), 1, 9999, None)
            if v:
                d["hp"] = v
                d["hitDice"] = strip_tags(str(hp["special"]))[:20]
        else:
            n, f, m = hp.get("number", 0), hp.get("faces", 8), hp.get("modifier", 0)
            if isinstance(n, int) and isinstance(f, int):
                d["hp"] = clamp(int(n * (f/2 + 1) + (m or 0)), 1, 9999)
                d["hitDice"] = f"{n}d{f}" + (f"+{m}" if m else "")[:20]
    elif isinstance(hp, (int, float)):
        d["hp"] = clamp(int(hp), 1, 9999)
    sp = x.get("speed")
    if isinstance(sp, dict):
        for k in ("walk","fly","swim","climb","burrow"):
            if k in sp:
                v = parse_int(sp[k], 0, 200, None)
                if v is not None:
                    d["speed"][k] = v
    for a in ABILITIES:
        v = x.get(a)
        if isinstance(v, (int, float)):
            d[a] = clamp(int(v), 1, 30)
    if isinstance(x.get("passive"), (int, float)):
        d["passivePerception"] = clamp(int(x["passive"]), 0, 30)
    parse_senses(x, d)
    d["languages"] = strip_tags(x.get("languages", ""))[:200] if isinstance(x.get("languages"), str) else ""
    d["damageVulnerabilities"] = flat_strings(x.get("damageVulnerabilities"), 30, 10)
    d["damageResistances"] = flat_strings(x.get("damageResistances"), 30, 10)
    d["damageImmunities"] = flat_strings(x.get("damageImmunities"), 30, 10)
    d["conditionImmunities"] = flat_strings(x.get("conditionImmunities"), 30, 15)
    d["skills"] = monster_skills(x)
    for t in (x.get("trait") or [])[:10]:
        if isinstance(t, dict) and t.get("name"):
            d["specialAbilities"].append({"name": strip_tags(t["name"])[:60],
                                      "desc": join_desc(t.get("entries"), 500)})
    for a in (x.get("action") or [])[:10]:
        if isinstance(a, dict) and a.get("name"):
            entry = {"name": strip_tags(a["name"])[:60], "desc": join_desc(a.get("entries"), 500)}
            ab, dd, _ = parse_attack(a.get("entries"))
            if ab:
                entry["attackBonus"] = clamp(int(ab.group(1)), -5, 20)
            if dd:
                entry["damageDice"] = dd.group(1).strip()[:30]
                if dd.group(2) and dd.group(2) in ("acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"):
                    entry["damageType"] = dd.group(2)
            d["actions"].append(entry)
    la = x.get("legendary")
    la_count = 3
    if isinstance(la, dict):
        la_count = parse_int(la.get("count"), 1, 5, 3) or 3
        la = la.get("actions", [])
    if isinstance(la, list):
        d["legendaryActionsPerRound"] = clamp(la_count, 1, 5)
    for a in (la or [])[:10]:
        if isinstance(a, dict) and a.get("name"):
            entry = {"name": strip_tags(a["name"])[:60], "desc": join_desc(a.get("entries"), 500), "cost": 1}
            if isinstance(a.get("cost"), int):
                entry["cost"] = clamp(a["cost"], 1, 3)
            ab, dd, _ = parse_attack(a.get("entries"))
            if ab:
                entry["attackBonus"] = clamp(int(ab.group(1)), -5, 20)
            if dd:
                entry["damageDice"] = dd.group(1).strip()[:30]
                if dd.group(2) and dd.group(2) in ("acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"):
                    entry["damageType"] = dd.group(2)
            d["legendaryActions"].append(entry)
    return d

# ---------------------------------------------------------------- deities ----
def map_deity(x):
    return {"pantheon": strip_tags(x.get("pantheon", ""))[:60],
            "title": strip_tags(x.get("title", ""))[:120],
            "category": strip_tags(x.get("category", ""))[:60],
            "alignment": ALIGN_TEXT(x.get("alignment")),
            "domains": [strip_tags(d)[:40] for d in (x.get("domains") or [])[:10] if isinstance(d, str)],
            "province": strip_tags(x.get("province", ""))[:120],
            "symbol": strip_tags(x.get("symbol", ""))[:200],
            "description": join_desc(x.get("entries"), 4000)}

def ALIGN_TEXT(al):
    if isinstance(al, str):
        al = [al]
    if not isinstance(al, list):
        return ""
    parts = [ALIGN.get(str(a), str(a)) for a in al if a]
    return " ".join(p for p in parts if p)[:40]

# -------------------------------------------------------------- languages ----
def map_language(x, scripts_by_name):
    speakers = [strip_tags(s)[:60] for s in (x.get("typicalSpeakers") or [])[:20] if isinstance(s, str)]
    script = x.get("script") or scripts_by_name.get(x["name"].lower(), "")
    return {"languageType": str(x.get("type", ""))[:30],
            "script": strip_tags(script)[:60],
            "typicalSpeakers": speakers,
            "description": join_desc(x.get("entries"), 4000)}

# ------------------------------------------------------------------ main ----
def main():
    os.makedirs(OUT, exist_ok=True)
    stats = collections.Counter()
    packs = collections.defaultdict(list)  # (type) -> rows

    # global indexes for _copy resolution
    opt_index = build_index(glob.glob(f"{DATA}/optionalfeatures.json"))
    items_index = build_index(glob.glob(f"{DATA}/items.json") + glob.glob(f"{DATA}/items-base.json"))
    races_index = build_index(glob.glob(f"{DATA}/races.json"))
    spells_index = {}
    for p in glob.glob(f"{DATA}/spells/*.json"):
        if "fluff" in p or "foundry" in p or "index" in os.path.basename(p):
            continue
        for e in entries_of(load(p)):
            if isinstance(e, dict) and e.get("name") and "_copy" not in e:
                spells_index[f"{e['name'].lower()}|{str(e.get('source','')).lower()}"] = e
                spells_index.setdefault(e["name"].lower(), e)

    def in_shelf(x):
        return str(x.get("source", "")).upper() in {s.upper() for s in SHELF_SET}

    # spells
    for p in glob.glob(f"{DATA}/spells/*.json"):
        if "fluff" in p or "foundry" in p or "index" in os.path.basename(p):
            continue
        es = [e for e in entries_of(load(p)) if isinstance(e, dict) and in_shelf(e)]
        for x in resolve_copies(es, spells_index):
            if not x.get("name"):
                continue
            packs["spell"].append({"type": "spell", "name": strip_tags(x["name"])[:60], "data": map_spell(x)})
    # feats
    es = [e for e in entries_of(load(f"{DATA}/feats.json")) if isinstance(e, dict) and in_shelf(e)]
    for x in resolve_copies(es, build_index([f"{DATA}/feats.json"])):
        packs["feat"].append({"type": "feat", "name": strip_tags(x["name"])[:60], "data": map_feat(x)})
    # backgrounds
    es = [e for e in entries_of(load(f"{DATA}/backgrounds.json")) if isinstance(e, dict) and in_shelf(e)]
    for x in resolve_copies(es, build_index([f"{DATA}/backgrounds.json"])):
        packs["background"].append({"type": "background", "name": strip_tags(x["name"])[:60], "data": map_background(x)})
    # races + subraces
    es = [e for e in entries_of(load(f"{DATA}/races.json")) if isinstance(e, dict) and in_shelf(e)]
    for x in resolve_copies(es, races_index):
        parent = x.get("race") or x.get("spells") and None
        if isinstance(x.get("race"), str):
            packs["subrace"].append({"type": "subrace", "name": strip_tags(x["name"])[:60], "data": map_subrace(x, x["race"])})
        else:
            packs["race"].append({"type": "race", "name": strip_tags(x["name"])[:60], "data": map_race(x)})
    # classes + subclasses
    for p in glob.glob(f"{DATA}/class/*.json"):
        if "fluff" in p or "foundry" in p or "index" in os.path.basename(p):
            continue
        d = load(p)
        cls = [c for c in d.get("class", []) if isinstance(c, dict) and in_shelf(c)]
        for x in resolve_copies(cls, build_index([p], "class")):
            m = map_class(x, {})
            if m:
                packs["class"].append({"type": "class", "name": strip_tags(x["name"])[:60], "data": m})
        subs = [c for c in d.get("subclass", []) if isinstance(c, dict) and in_shelf(c)]
        for x in resolve_copies(subs, build_index([p], "subclass")):
            packs["subclass"].append({"type": "subclass", "name": strip_tags(x["name"])[:60], "data": map_subclass(x, x.get("class", ""), opt_index)})
    # items (base + magic)
    es = [e for e in entries_of(load(f"{DATA}/items-base.json")) if isinstance(e, dict) and in_shelf(e)]
    for x in resolve_copies(es, items_index):
        packs["item"].append({"type": "item", "name": strip_tags(x["name"])[:60], "data": map_item_base(x)})
    es = [e for e in entries_of(load(f"{DATA}/items.json")) if isinstance(e, dict) and in_shelf(e)]
    for x in resolve_copies(es, items_index):
        packs["item"].append({"type": "item", "name": strip_tags(x["name"])[:60], "data": map_item_magic(x)})
    # monsters (bestiary + adventures)
    mon_index = build_index(glob.glob(f"{DATA}/bestiary/*.json") + glob.glob(f"{DATA}/adventure/*.json"))
    for p in glob.glob(f"{DATA}/bestiary/*.json") + glob.glob(f"{DATA}/adventure/*.json"):
        if "fluff" in p or "foundry" in p:
            continue
        es = [e for e in entries_of(load(p)) if isinstance(e, dict) and in_shelf(e)]
        for x in resolve_copies(es, mon_index):
            m = map_monster(x)
            if m:
                packs["monster"].append({"type": "monster", "name": strip_tags(x["name"])[:60], "data": m})

    # deities + languages (reference content)
    deity_index = build_index([f"{DATA}/deities.json"], "deity")
    for x in resolve_copies([e for e in entries_of(load(f"{DATA}/deities.json"), "deity") if isinstance(e, dict) and in_shelf(e)], deity_index):
        packs["deity"].append({"type": "deity", "name": strip_tags(x["name"])[:60], "data": map_deity(x)})
    langd = load(f"{DATA}/languages.json")
    scripts_by_name = {str(s.get("name","")).lower(): s.get("name","") for s in langd.get("languageScript", []) if isinstance(s, dict)}
    lang_index = build_index([f"{DATA}/languages.json"], "language")
    for x in resolve_copies([e for e in entries_of(load(f"{DATA}/languages.json"), "language") if isinstance(e, dict) and in_shelf(e)], lang_index):
        packs["language"].append({"type": "language", "name": strip_tags(x["name"])[:60], "data": map_language(x, scripts_by_name)})

    # write chunked packs
    CAP = 200
    for t, rows in sorted(packs.items()):
        for i in range(0, len(rows), CAP):
            chunk = rows[i:i+CAP]
            fn = f"{t}{'' if i == 0 else '-' + str(i//CAP + 1)}.json"
            with open(os.path.join(OUT, fn), "w") as f:
                json.dump({"system": "dnd5e", "items": chunk}, f, indent=1)
            stats[t] += len(chunk)
    print("rows per type:", dict(stats), "TOTAL:", sum(stats.values()))

if __name__ == "__main__":
    main()
