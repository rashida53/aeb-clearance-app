// The data-model map handed to the LLM in the system prompt. The generic tools
// only work well if the model knows the collections, their fields, and how they
// relate — so keep this accurate and in sync with dbAccess.js's whitelist.

const SCHEMA_MAP = `DATA MODEL (all collections are read-only via your tools)

How to query:
- Use count_documents for "how many" questions.
- Use find_documents to fetch/list documents (max 100).
- Use aggregate for group-bys and joins ($lookup) BETWEEN COLLECTIONS IN THE SAME DATABASE.
- IDs (_id and reference fields) appear as 24-character hex strings in results. To
  filter by one, wrap it as {"$oid": "<hex>"} — e.g. {"user": {"$oid": "662f..."}}.
- To relate two collections, first find the target to get its _id, then filter the
  other collection by that id (wrapped in $oid), OR use aggregate with $lookup.
- Two separate databases (fmb, clearance). $lookup cannot cross them; join across
  databases by making two queries and combining the results yourself.

fmb database:
- users: fullName, hofIts (household ITS id, the business key — a number, NOT money),
    spouseName, zone (free-form string), pickupGroup, isActive (bool). "Active" = isActive != false.
- miqaats: title (event name), date (Date), hijriDate (display string), time, description,
    hosts (→users._id[]), menu (→dishes._id[]).
- rsvps: user (→users._id), miqaat (→miqaats._id), adults (Number), children (Number).
    One doc per (user,miqaat). THERE IS NO yes/no status — a doc's existence means the
    user responded; adults/children are attendance counts (0/0 = responded, not coming).
    "Has not RSVP'd" = no rsvp doc for that (user, miqaat). Prefer the
    list_miqaat_non_responders tool for this question.
- events + eventrsvps + invitees: a SEPARATE event system (do not confuse with miqaats/rsvps).
    eventrsvps has men/women/children/toddlers counts; invitees defines who was invited.
- pledges: user (→users._id), period (string like "1447-48"), amount (Number), isPaid (bool),
    pledgedOn (Date), status (free-form string).
- qbopens: hofIts, user (→users._id), qb_id (unique), amount, balance (Number), due (string),
    customer. QuickBooks open balances (a person's outstanding balances / "open pledges").
- pickupgroups: name, users (→users._id[]).
- cooks: fullName.
- dishes: dishName, category, allergens.
- menuitems: cook (→cooks._id), dish (→dishes._id), menuDate (Date), amount, isPaid, forAll, fmbItem.
    THIS IS THE LINK between cooks and dishes: a cook makes dishes via menuitems
    (menuitems.cook = the cook, menuitems.dish = the dish). To find "dishes a cook made",
    go cooks -> menuitems (by cook) -> dishes (by dish).
- signups: user (→users._id), menuItem (→menuitems._id), size.
- feedbacks: user (→users._id), menuItem (→menuitems._id), rating fields.

clearance database (this app's own):
- approvals: hofIts, requester, approver, remarks, masjid, approvedAt (epoch ms Number).
- letters: requester, approver, reason, hofIts, generatedOn (epoch ms Number).
- masjid: its (HOF ITS), status.
- slots: date (Date), startTime/endTime ("HH:MM" strings), bookedBy (→users._id), group, volunteer (→users._id).
- localniyyats: user (→users._id), year (string), kr, ut (Numbers), schedule.
- huqooq: user (→users._id), year (string like "1447-48"), wajebaat (Number), sf (Number),
    wcheck, sfcheck. This is the Takhmeen / Wajebaat record. NOTE: huqooq lives in the
    clearance DB but its user field references users in the fmb DB — join across DBs in two steps.

Date context: current year is "1448-49"; last year is "1447-48". Dates stored as Date
appear as ISO strings; approvals.approvedAt and letters.generatedOn are epoch milliseconds.

Blocked (never queryable): members (passwords/email) and ach (encrypted bank info).

QUERY RULES (follow exactly):
- "Active" means isActive != false. ALWAYS express it as {"isActive": {"$ne": false}} — never
  {"isActive": true}, because many active users have no isActive field and true-equality misses them.
- Only add an active filter when the user explicitly asks for "active" users. For "everyone",
  "all", or "list ... in zone X", do NOT filter by isActive.
- zone is matched as a string (e.g. "4").
- NEVER invent, guess, or use a placeholder _id. To reference a document by id, FIRST find it (by
  name/title) and read its real _id from the results, THEN pass {"$oid": "<that id>"} in the next call.
- "Who has NOT done X / is missing X / without X" is an ANTI-JOIN — you CANNOT answer it by filtering
  one collection. Use aggregate on the base collection with $lookup to the related collection, then
  keep rows whose joined array is empty ($size 0). See the RSVP example below.

Examples:
- "how many active users" -> count_documents("users", {"isActive": {"$ne": false}})
- "everyone in zone 4" -> find_documents("users", {"zone": "4"})
- "active users in zone 2" -> find_documents("users", {"zone": "2", "isActive": {"$ne": false}})
- "Hamza Karachiwala's open balances" -> find_documents("users", {"fullName": {"$regex": "Hamza Karachiwala", "$options": "i"}})
  then find_documents("qbopens", {"user": {"$oid": "<the user _id>"}})
- "who has NOT RSVP'd for <miqaat title>" (anti-join):
  step 1: find_documents("miqaats", {"title": {"$regex": "<title>", "$options": "i"}})  // read its _id
  step 2: aggregate("users", [
            {"$match": {"isActive": {"$ne": false}}},
            {"$lookup": {"from": "rsvps", "let": {"uid": "$_id"},
              "pipeline": [{"$match": {"$expr": {"$and": [
                 {"$eq": ["$user", "$$uid"]},
                 {"$eq": ["$miqaat", {"$oid": "<miqaat _id from step 1>"}]}
              ]}}}], "as": "rsvp"}},
            {"$match": {"rsvp": {"$size": 0}}},
            {"$project": {"_id": 0, "fullName": 1, "hofIts": 1}}
          ])
- "which dishes has <cook name> cooked" (multi-hop: cook -> menuitems -> dishes):
  step 1: find_documents("cooks", {"fullName": {"$regex": "<name>", "$options": "i"}})  // read its _id
  step 2: aggregate("menuitems", [
            {"$match": {"cook": {"$oid": "<cook _id from step 1>"}}},
            {"$lookup": {"from": "dishes", "localField": "dish", "foreignField": "_id", "as": "d"}},
            {"$unwind": "$d"},
            {"$group": {"_id": "$d.dishName"}}
          ])  // each returned _id is a unique dish name`;

module.exports = { SCHEMA_MAP };
