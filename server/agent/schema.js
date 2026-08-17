// The authoritative data-model map handed to the LLM. The generic tools only
// work well if the model knows the collections, their fields, how they relate,
// and the two-database architecture. Keep this in sync with dbAccess.js.

const SCHEMA_MAP = `ARCHITECTURE — TWO DATABASES:
There are two MongoDB databases; every collection belongs to exactly one, and the tools route automatically by collection name (you never specify the database).
- "fmb" database: the community app's data (people, events, food, finances source).
- "clearance" database: this app's own records (clearance letters, approvals, wajebaat/takhmeen, niyyat commitments, volunteer slots).
The clearance database REFERENCES the fmb "users" collection — clearance records store an fmb user's _id (or their hofIts string). fmb data never references clearance.

CROSS-DATABASE JOINS: aggregate/$lookup work ONLY within a single database — you CANNOT $lookup between fmb and clearance. To combine them, do it in two steps: query one database, take the _id (or hofIts) from the result, then query the other database with it. Wrap an ObjectId value as {"$oid": "<24-hex>"}.

USERS IS THE HUB: the fmb "users" collection is the join point for almost everything. Its _id is referenced by fmb collections (rsvps.user, pledges.user, qbopens.user, miqaats.hosts, ...) AND by clearance collections (huqooq.user, localniyyats.user, slots.bookedBy/volunteer, approvals.requester). The string "hofIts" (household ITS number) is the secondary bridge key.

TOOL USAGE:
- count_documents for "how many"; find_documents to fetch/list (max 100); aggregate for group-bys and $lookup joins WITHIN one database.
- _id and reference fields appear as 24-hex strings; to filter by one, pass {"$oid": "<hex>"}. In aggregate $match on an id, also use {"$oid": ...} (raw aggregation does not auto-cast ids).
- NEVER invent an id — first find the target to get its real _id, then use it.
- The database is the SOURCE OF TRUTH; if a question maps to a collection below, use the data tools even if the info might also be written in a document.

fmb DATABASE:
- users (THE HUB): fullName, spouseName, hofIts (household ITS, unique string), zone (free-form string), pickupGroup (string = pickupgroups.name), isActive (bool). "Active" = isActive != false.
- miqaats (religious events): title, date (Date), hijriDate (display string), time, description, isCommittee (bool); hosts[] -> users._id; menu[] -> dishes._id.
- rsvps: user -> users._id, miqaat -> miqaats._id, adults (Number), children (Number). One doc per (user,miqaat). NO status field: a doc's existence = responded; adults/children are attendance counts. "Has NOT RSVP'd" = no rsvp doc.
- events: title, date (Date), hijriDate, eventType ("public"/"private"), venue, category, womenOnly/menOnly (bool); hosts[] -> members._id. (NOTE: events are hosted by MEMBERS; miqaats are hosted by USERS. Separate systems — do not mix miqaats/rsvps with events/eventrsvps.)
- eventrsvps: user -> users._id, event -> events._id, men/women/children/toddlers (Numbers).
- invitees: user -> users._id, event -> events._id, men/women/children (STRINGS here, not Numbers — don't sum without converting).
- pledges: user -> users._id, period (string like "1447-48"), amount (Number), isPaid (bool), pledgedOn (Date), status (free-form string, e.g. "PENDING").
- qbopens (QuickBooks billing — a person's outstanding balances / "open pledges"): user -> users._id, customer (household name string — use this for the person's name, no join needed), hofIts, qb_id (unique), amount, balance (Numbers), due (string).
    qb_id encodes a billing CATEGORY + year + sequence, e.g. "Sabil_2026-052" (sabeel; Gregorian year, underscore) or "Madrasa-1447-070" (madrasa; hijri year, dash) — the year style/separator VARIES by category. To filter a category, regex qb_id on the category word: sabeel/sabil -> "Sabil", madrasa -> "Madrasa", niyaz -> "Niyaz" (also "FMB", "KR"). To scope a year, also match the year digits AS THEY APPEAR in qb_id (e.g. "2026" or "1447"). balance > 0 = UNPAID / still owed; balance 0 or absent = paid.
- pickupgroups: name (string), users[] -> users._id. Prefer reading a user's group via users.pickupGroup (string) == pickupgroups.name; the users[] array can be stale.
- cooks: fullName.
- dishes: dishName (unique), category, allergens[].
- menuitems (THE LINK between cooks and dishes): cook -> cooks._id, dish -> dishes._id, menuDate (Date), amount, isPaid, forAll, fmbItem (bools). A cook's dishes = menuitems by cook, then their dish -> dishes.
- signups: user -> users._id, menuItem -> menuitems._id, size (string).
- feedbacks: user -> users._id, menuItem -> menuitems._id, rating fields (Numbers).

clearance DATABASE (each row is tied to an fmb user):
- approvals: hofIts (string = users.hofIts), requester (-> users._id), approver (name string, not an id), remarks, masjid, approvedAt (epoch-MILLISECONDS Number).
- letters: hofIts (string = users.hofIts), requester (name string), approver (name string or "AUTO"), reason, generatedOn (epoch-MILLISECONDS Number).
- masjid: its (string = users.hofIts), status.
- slots (volunteer time slots): date (Date), startTime/endTime ("HH:MM" strings), group (string), bookedBy (-> users._id), volunteer (-> users._id).
- localniyyats (a.k.a. Commitment): user (-> users._id), year (string like "1448-49"), kr, ut (Numbers), schedule.
- huqooq (a.k.a. Takhmeen / Wajebaat): user (-> users._id), year (string), wajebaat (Number), sf (Number), wcheck, sfcheck. Unique (user, year).

GOTCHAS:
- Facts about people live in "users" (keyed by hofIts). "members" (login accounts, passwords, email) and "ach" (encrypted bank info) are BLOCKED — not queryable.
- "Active" = {"isActive": {"$ne": false}} — NEVER {"isActive": true} (the field is often missing). Only filter by active when the user asks for active people.
- Year format is "1448-49" (current) / "1447-48" (last year) — not derivable from data, use these. Clearance collections use the field name "year"; fmb "pledges" uses "period" (same format).
- Dates: miqaats/events/slots/menuitems.menuDate/pledges.pledgedOn are Date (compare with ISO date ranges). approvals.approvedAt and letters.generatedOn are epoch-millisecond Numbers (compare numerically). No day-of-week is stored — derive it in aggregate with $dayOfWeek if needed.
- zone / status / eventType / roles are free-form strings.
- NAME MATCHING: names are NOT stored as "First Last". users.fullName and especially qbopens.customer are often "Last, First ..." and may include honorifics ("bhai"/"bhen") or a spouse. Match a person by AND-ing a case-insensitive regex for EACH name token, so word order and extra words don't matter — e.g. for "Murtaza Rawat": {"$and": [{"<field>": {"$regex": "Murtaza", "$options": "i"}}, {"<field>": {"$regex": "Rawat", "$options": "i"}}]}. Never match a full name as one ordered phrase.

EXAMPLES:
- "how many active users" -> count_documents("users", {"isActive": {"$ne": false}})
- "everyone in zone 4" -> find_documents("users", {"zone": "4"})
- "<name>'s open pledges / balances" (open = balance > 0; the name is on qbopens.customer, stored "Last, First") -> find_documents("qbopens", {"$and": [{"customer": {"$regex": "<token1>", "$options": "i"}}, {"customer": {"$regex": "<token2>", "$options": "i"}}], "balance": {"$gt": 0}}), and report each result's customer + qb_id + balance. (If you need the person's household/zone too, also resolve users by the same token-AND regex on fullName.)
- "<name>'s Wajebaat last year" (CROSS-DB: users in fmb, huqooq in clearance) -> find the user in "users" (fmb), then find_documents("huqooq", {"user": {"$oid": "<user _id>"}, "year": "1447-48"})
- "who has NOT RSVP'd for <miqaat title>" (anti-join) ->
  step 1: find_documents("miqaats", {"title": {"$regex": "<title>", "$options": "i"}})   // read its _id
  step 2: aggregate("users", [
            {"$match": {"isActive": {"$ne": false}}},
            {"$lookup": {"from": "rsvps", "let": {"uid": "$_id"},
              "pipeline": [{"$match": {"$expr": {"$and": [
                 {"$eq": ["$user", "$$uid"]}, {"$eq": ["$miqaat", {"$oid": "<miqaat _id>"}]}]}}}], "as": "rsvp"}},
            {"$match": {"rsvp": {"$size": 0}}},
            {"$project": {"_id": 0, "fullName": 1, "hofIts": 1}}])
- "which dishes has <cook> cooked" (multi-hop: cooks -> menuitems -> dishes) ->
  step 1: find_documents("cooks", {"fullName": {"$regex": "<name>", "$options": "i"}})
  step 2: aggregate("menuitems", [
            {"$match": {"cook": {"$oid": "<cook _id>"}}},
            {"$lookup": {"from": "dishes", "localField": "dish", "foreignField": "_id", "as": "d"}},
            {"$unwind": "$d"}, {"$group": {"_id": "$d.dishName"}}])   // each _id is a unique dish name
- "how many children RSVP'd for <miqaat>" (sum a count field) ->
  find the miqaat _id, then aggregate("rsvps", [{"$match": {"miqaat": {"$oid": "<id>"}}},
    {"$group": {"_id": null, "children": {"$sum": "$children"}, "adults": {"$sum": "$adults"}}}])
- "which users have NOT paid sabeel for 2026" (unpaid = open balance on a billing category) ->
  find_documents("qbopens", {"qb_id": {"$regex": "Sabil.*2026", "$options": "i"}, "balance": {"$gt": 0}}), then list each result's "customer".`;

module.exports = { SCHEMA_MAP };
