"""Evidence-based career intersections. Place, timing and personal contact are separate."""
import calendar
import datetime as dt
import hashlib
import itertools
import re

def reconcile_career_posts(data):
    """Reflect reviewed closures in derived careers; keep the stored seed and ledger intact.

    Only an exact office/title match can close an open career. A dated removal
    is not used as an invented effective end when the role's end is unknown.
    """
    people={p['id']:p for p in data.get('people',[])}
    for post in data.get('career_posts',[]):
        if not post.get('is_current') or post.get('end'):continue
        roles=[r for r in people.get(post['person_id'],{}).get('roles',[])
               if r.get('org_id')==post.get('organization_id') and
               (r.get('title')==post.get('title') or
                (r.get('title_en') and r.get('title_en')==post.get('title_en')))]
        if any(r.get('status')=='current' for r in roles):continue
        closed=[r for r in roles if r.get('status')=='former' and
                (not (r.get('until') or r.get('ended_announced_at')) or not post.get('start') or
                 (date_bounds(r.get('until') or r['ended_announced_at']) and date_bounds(post['start']) and
                  date_bounds(r.get('until') or r['ended_announced_at'])[1]>=date_bounds(post['start'])[0])) and
                (not r.get('since') or not post.get('start') or
                 (date_bounds(r['since']) and date_bounds(post['start']) and
                  date_bounds(r['since'])[0]<=date_bounds(post['start'])[1]))]
        if len(closed)!=1:continue
        role=closed[0];post.update(is_current=False,status='former',end=role.get('until'))
        post['source_ids']=list(dict.fromkeys(post.get('source_ids',[])+role.get('source_ids',[])))
        post['date_note']=(post.get('date_note','')+' 已按核对后的人物职务更新为曾任；'+
                           ('结束日期 '+role['until']+'。' if role.get('until') else '具体生效结束日未明确，不计算开放任期交集。'))

def date_bounds(value):
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}(?:-\d{2}){0,2}',value):return None
    try:
        parts=list(map(int,value.split('-')));year=parts[0]
        if len(parts)==1:return dt.date(year,1,1),dt.date(year,12,31)
        month=parts[1]
        if len(parts)==2:return dt.date(year,month,1),dt.date(year,month,calendar.monthrange(year,month)[1])
        day=dt.date(*parts);return day,day
    except ValueError:return None

def interval(post):
    start=date_bounds(post.get('start'))
    if post.get('end'):end=date_bounds(post['end'])
    elif post.get('is_current'):end=date_bounds(post.get('as_of_date') or post.get('latest_confirmed_at') or post.get('current_evidence_date'))
    else:end=None
    if not start or not end or start[0]>end[1]:return None
    return start,end

def overlap(a,b):
    ia,ib=interval(a),interval(b)
    if not ia or not ib:return None
    possible_start=max(ia[0][0],ib[0][0]);possible_end=min(ia[1][1],ib[1][1])
    if possible_start>possible_end:return None
    definite_start=max(ia[0][1],ib[0][1]);definite_end=min(ia[1][0],ib[1][0])
    # The same calendar day can be a handover; dates alone do not establish shared service.
    definite=definite_start<definite_end
    return {'type':'co_service' if definite else 'possible_overlap','start':str(definite_start if definite else possible_start),'end':str(definite_end if definite else possible_end),'precision_note':'起止日期精度不足，可能交接，不能确认同期任职。' if not definite else '根据公开任期计算出的确定交集；不表示私人熟识。'}

def place_ids(post,locations):
    result=set(post.get('location_ids',[]));pending=list(result)
    while pending:
        parent=locations.get(pending.pop(),{}).get('parent_id')
        if parent and parent not in result:result.add(parent);pending.append(parent)
    return sorted(result)

PLACE_PAIR_LIMIT = 40

def build_place_groups(data):
    """Large place memberships stay linear; selected-person links are expanded in the reader."""
    people={p["id"] for p in data.get("people",[])};locations={p["id"]:p for p in data.get("locations",[])};groups={}
    for post in data.get("career_posts",[]):
        if post.get("person_id") not in people or not post.get("source_ids") or post.get("verification_status") in ("unverified","conflicting"):continue
        for place in place_ids(post,locations):
            if place in ("china","central"):continue
            groups.setdefault(place,[]).append(post)
    return [dict(id="place-group-"+place,location_id=place,person_ids=sorted({p["person_id"] for p in posts}),post_ids=sorted({p["id"] for p in posts}),source_ids=sorted({s for p in posts for s in p["source_ids"]})) for place,posts in sorted(groups.items()) if len({p["person_id"] for p in posts})>PLACE_PAIR_LIMIT]

def build_network(data):
    people={p['id']:p for p in data.get('people',[])};locations={p['id']:p for p in data.get('locations',[])}
    posts=[p for p in data.get('career_posts',[]) if p.get('person_id') in people and p.get('source_ids') and p.get('verification_status') not in ('unverified','conflicting')]
    result=[];byorg={};byplace={}
    for p in posts:
        if p.get('organization_id') and interval(p):byorg.setdefault(p['organization_id'],[]).append(p)
        for place in place_ids(p,locations):
            if place not in ('central','china'):byplace.setdefault(place,[]).append(p)
    for oid,items in byorg.items():
        for a,b in itertools.combinations(items,2):
            if a['person_id']==b['person_id']:continue
            timing=overlap(a,b)
            if not timing:continue
            result.append({**timing,'from':a['person_id'],'to':b['person_id'],'organization_id':oid,'organization_name':a.get('organization_name',oid),'post_ids':[a['id'],b['id']],'location_ids':sorted(set(place_ids(a,locations))&set(place_ids(b,locations))),'source_ids':sorted(set(a['source_ids']+b['source_ids']))})
    for place,items in byplace.items():
        byperson={}
        for p in items:byperson.setdefault(p['person_id'],[]).append(p)
        if len(byperson)>PLACE_PAIR_LIMIT:continue
        for aid,bid in itertools.combinations(sorted(byperson),2):
            ap,bp=byperson[aid],byperson[bid]
            result.append({'type':'same_place','from':aid,'to':bid,'location_ids':[place],'post_ids':[p['id'] for p in ap+bp],'source_ids':sorted({s for p in ap+bp for s in p['source_ids']}),'precision_note':'同地经历可以发生在不同时期、不同机构；不据此称为同事。'})
    for record in data.get('person_connections',[]):
        if record.get('from') in people and record.get('to') in people and record.get('from')!=record.get('to') and record.get('source_ids') and record.get('type') in ('public_contact','documented_cowork'):
            result.append(record)
    unique={}
    for r in result:
        r={**r,'id':r.get('id') or 'link-'+hashlib.sha256(repr(sorted(r.items())).encode()).hexdigest()[:18]}
        unique[r['id']]=r
    return list(unique.values())
