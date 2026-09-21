"""Merge explicitly reviewed regional packets without replacing personal database overlays."""
import copy
import datetime as dt
import re
ALIASES={'shanghai-party':'shanghai_party_committee','shanghai-government':'shanghai_government'}
UPDATE_COLLECTIONS={'people','career_posts','institutions','sources','profile_facts'}
UPDATE_FIELDS={'id','collection','record_id','before','set','source_ids','reviewed_at','reason'}

def canonicalize(value):
    if isinstance(value,list):return [canonicalize(v) for v in value]
    if not isinstance(value,dict):return value
    result={k:canonicalize(v) for k,v in value.items()}
    for key in ('id','org_id','organization_id','parent_id','from','to'):
        if key in result and isinstance(result[key],str):result[key]=ALIASES.get(result[key],result[key])
    if 'org_ids' in result:result['org_ids']=[ALIASES.get(i,i) for i in result['org_ids']]
    # Public prose should explain the relationship, not expose schema field names.
    for key in ('limits','limits_zh'):
        if key in result:result[key]=[v.replace('parent_id仅用于分组','图中分组不代表完整领导关系') for v in result[key]]
    return result

def _same_value(actual,expected):
    """JSON-type-sensitive equality; dictionary order is immaterial, list order is not."""
    if type(actual) is not type(expected):return False
    if isinstance(actual,dict):
        return actual.keys()==expected.keys() and all(_same_value(actual[k],expected[k]) for k in actual)
    if isinstance(actual,list):
        return len(actual)==len(expected) and all(_same_value(a,b) for a,b in zip(actual,expected))
    return actual==expected

def _apply_reviewed_updates(data,updates):
    """Apply exact reviewed corrections; provenance stays in the immutable source packet.

    An absent top-level field compares as None. Setting None writes an explicit null;
    it never deletes a field. Entire selected values (including lists) are compared.
    Unlike additions, corrections are not alias-normalized: before must match the
    actual merged record, and stable record IDs cannot be changed.
    """
    source_ids={s['id'] for s in data.get('sources',[])}
    seen=set()
    for update in updates:
        if not isinstance(update,dict) or set(update)!=UPDATE_FIELDS:
            raise ValueError('Reviewed update requires exactly: '+', '.join(sorted(UPDATE_FIELDS)))
        uid=update['id']
        for field in ('id','record_id'):
            value=update[field]
            if not isinstance(value,str) or not value.strip() or value!=value.strip():
                raise ValueError('Invalid reviewed update '+field)
        if uid in seen:raise ValueError('Duplicate reviewed update ID '+uid)
        seen.add(uid)
        kind=update['collection']
        if not isinstance(kind,str) or kind not in UPDATE_COLLECTIONS:
            raise ValueError('Unknown reviewed update collection '+str(kind))
        before,changes=update['before'],update['set']
        if not isinstance(before,dict) or not isinstance(changes,dict) or not before or before.keys()!=changes.keys():
            raise ValueError('Reviewed update before/set require the same nonempty keys: '+uid)
        if 'id' in changes or any(not isinstance(k,str) or not k.strip() for k in changes):
            raise ValueError('Reviewed update cannot change id or use invalid field keys: '+uid)
        supporting=update['source_ids']
        if not isinstance(supporting,list) or not supporting or any(
                not isinstance(s,str) or not s.strip() or s!=s.strip() or s not in source_ids for s in supporting):
            raise ValueError('Reviewed update requires known supporting source IDs: '+uid)
        if not isinstance(update['reason'],str) or not update['reason'].strip():
            raise ValueError('Reviewed update requires a reason: '+uid)
        stamp=update['reviewed_at']
        if not isinstance(stamp,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',stamp):
            raise ValueError('Reviewed update requires reviewed_at YYYY-MM-DD: '+uid)
        try:dt.date.fromisoformat(stamp)
        except ValueError:raise ValueError('Invalid reviewed update calendar date: '+uid) from None
        matches=[r for r in data.get(kind,[]) if r.get('id')==update['record_id']]
        if len(matches)!=1:
            raise ValueError('Reviewed update requires one existing record: '+uid+' '+update['record_id'])
        record=matches[0]
        for field,expected in before.items():
            if not _same_value(record.get(field),expected):
                # Do not dump the record or its private notes into logs on failure.
                raise ValueError('Stale reviewed update '+uid+': '+kind+'/'+update['record_id']+' field '+field)
        record.update(copy.deepcopy(changes))

def merge_packet(data,packet):
    """Merge additions, then guarded corrections, without writing any files or SQLite.

    A packet containing corrections is atomic in memory: a rejected correction
    leaves the caller's data and source packet unchanged, including its additions.
    Reapplying an already changed value is intentionally a stale-precondition error.
    """
    updates=packet.get('reviewed_updates',[])
    if not isinstance(updates,list):raise ValueError('reviewed_updates must be a list')
    additions=canonicalize(copy.deepcopy({k:v for k,v in packet.items() if k!='reviewed_updates'}))
    working=copy.deepcopy(data) if updates else data
    _merge_additions(working,additions)
    _apply_reviewed_updates(working,updates)
    if updates:
        data.clear();data.update(working)

def _merge_additions(data,packet):
    for kind in ('sources','locations','institutions','people','career_posts','person_connections','events','guides','regional_coverage','research_coverage','profile_facts'):
        values={v['id']:v for v in data.setdefault(kind,[])}
        for item in packet.get(kind,[]):
            old=values.get(item['id'])
            if old is None:data[kind].append(item);values[item['id']]=item;continue
            if old==item:continue
            if kind=='sources':
                if old['url'].rstrip('/')!=item['url'].rstrip('/'):raise ValueError('Conflicting source URL '+item['id'])
                for k,v in item.items():old.setdefault(k,v)
            elif kind in ('locations','institutions'):
                for key in ('parent_id','kind'):
                    if old.get(key) and item.get(key) and old[key]!=item[key]:raise ValueError('Conflicting structure '+item['id']+' '+key)
                for k,v in item.items():
                    if k in ('source_ids','location_ids'):old[k]=list(dict.fromkeys(old.get(k,[])+v))
                    else:old.setdefault(k,v)
            else:raise ValueError('Conflicting reviewed record '+kind+' '+item['id'])
    known={(r['from'],r['to'],r['type'],r.get('label','')) for r in data['relations']}
    for r in packet.get('relations',[]):
        signature=(r['from'],r['to'],r['type'],r.get('label',''))
        if signature not in known:data['relations'].append(r);known.add(signature)
    for addition in packet.get('role_additions',[]):
        p=next(p for p in data['people'] if p['id']==addition['person_id'])
        role=addition['role']
        if role not in p['roles']:p['roles'].append(role)
        p['source_ids']=list(dict.fromkeys(p['source_ids']+role.get('source_ids',[])))
