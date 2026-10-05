# Headquarters – Concept (Phase 8)

## Problem

The game reads like a website: a status bar, seven tabs and panels with tables. Nothing makes the player
feel that they sit in the head office of a company and run it. Navigation, the look of the panels and the
lack of life (no people, no reactions) all add to that.

## Goal

The **headquarters (HQ)** becomes the main view on desktop. The player sits in their office and reaches
every area through objects in the room. People (board members, rival CEOs) talk to the player. Paper
documents replace forms. The office grows with the company. New mechanics give the office a purpose in
play, not only in looks.

Decisions (Michael):

- Real rebuild: the HQ is the main view, not a skin around the tabs
- Higher-quality look: a drawn canvas scene in the board game style of the landscapes (warm paper, ink
  outlines, cardboard shadows), not plain CSS
- Phone: keeps the tabs; the HQ shows there as a header picture with the board members
- New mechanics are welcome

Clickable prototype (no game logic, mock data): [prototypes/headquarters.html](prototypes/headquarters.html).

## 1. The office as main view (web)

A canvas scene (`scene/office.ts`), same drawing toolkit and palette as the landscapes, front view into
the CEO's office. Every object is a hotspot (hover: ink outline + label, click: opens the area, keyboard:
the hotspots are real buttons laid over the canvas, so tab order and screen readers work).

| Object | Opens | Live details in the object |
|---|---|---|
| Wall map of the four regions | Sites | own plots as company pins, flashing pin when a site needs action |
| Ticker / monitor on the wall | Power market | current price and arrow, scrolling ticker |
| Safe / bank folder | Bank | cash on a small display, loan as a stack of IOUs |
| Side door "Hinterzimmer" | Lobby & espionage | door ajar when a spy report is valid, light under the door when detectives are active |
| Newspaper on the desk | News | real headline of the latest event |
| Portrait wall / trophy shelf | Rivals | the rival crests in rank order, own trophies from milestones |
| Window | Overview / landscape | shows the region with the largest own capacity, season and time of day |
| Desk phone | Board messages | rings (sound + wobble) when a board member or rival has something |
| Big stamp on the desk | End quarter | stamp animation on the quarter report |

Areas open as a **folder that slides onto the desk** (overlay over the dimmed office) instead of a tab
switch. The content of today's views is reused, restyled as paper: binder tabs, paper clips, rubber
stamps, typewriter numbers for figures. `Esc` or a click on the office closes the folder.

**Documents instead of dialogs**

- Permit application: form with fields, the player signs, the authority's stamp lands on approval
- Lease: contract with seal and the landowner's signature
- Spy report: "VERTRAULICH" file, information the report does not cover is redacted (black bars)
- Quarter report: board meeting (see 3.) with the figures as a presentation slide
- News: newspaper layout with headline, sub-headline and columns

**Atmosphere**

- Time of day in the window follows the quarter (season light), the office lamp at night/winter
- Quiet room sound (clock, distant typing), phone ring, stamp, paper rustle – through `sound.ts`, off with
  the sound button
- Reduced motion: still picture, no ticker, no wobble

**Phone (< 760 px)**

Tabs stay as today. The overview tab gets a cropped office picture (desk with the board members) as
header, the board messages and the documents look the same as on desktop.

## 2. People

- **Board members** with portrait (same style as the CEO portraits), name and department. They replace the
  "Handlungsbedarf" list: each open task is said by the responsible person
  ("Die Genehmigung für Nordsee 3 ist durch – soll ich den Bau starten?") with the button right in the
  speech bubble.
- **Rival CEOs** call on the phone: after a lobby trick against the player that was traced, after winning
  a cable duel, when they overtake the player in rank. Texts per persona (`AI_DEF`) in `texts.ts`; the
  engine only emits the events it emits today.
- The **quarter report** becomes a board meeting at the conference table: the CFO presents revenue and
  costs, then the rival moves are played as reports from the board members.

## 3. New mechanics (engine)

All three go through actions and events like everything else, rivals use them too, the effect on balance is
measured with the simulation script (normal/hard) before merging.

### 3a. The board (`hireExecutive`, `fireExecutive`)

The player starts alone (CEO). They can hire up to four executives, one per department. Each costs a
signing fee and a salary per quarter and gives one clear advantage:

| Executive | Department | Effect (values to be tuned) |
|---|---|---|
| Projektentwicklung | permits | permit chance +10 %-points, one more survey per quarter |
| Netz & Technik | grid | cable duel time +20 %, repowering cheaper |
| Handel | market | PPA offers +3 €/MWh, storage spread share up |
| Recht & Kommunikation | lobby | court damages +50 %, own tricks less likely traced |

Two quality levels per position (junior/senior) like the detectives. Executives are visible to rivals with
a spy report. Rivals hire by expected value (hard) or by a simple rule (normal). The board members in the
office are exactly these people – an empty chair shows a vacancy.

### 3b. Board decisions (`decide`)

At the start of a quarter, sometimes (seeded) a **decision card** lies on the desk: a short situation with
two or three options, each with a clear effect. Examples:

- Citizens' initiative against a planned wind farm → offer citizens' participation (costs, permit chance
  up) / ignore (risk of rejection up) / move the project (delay)
- Supplier offers turbines cheap if ordered now → order (cash now, build cost down for N quarters) / decline
- Journalist asks about a rival's lobby trick → tell (rival loses reputation: higher trick cost) / stay
  silent
- Heat wave: grid operator asks for flexible storage → take part (income, storage blocked) / decline

Cards are data (`DECISIONS` in `data.ts`) like `WORLD_EVENTS`, with conditions (owns storage, has a
pending permit…). An open card blocks nothing; if it is not decided by the end of the quarter, the default
option applies. Rivals decide with the same cards (by value). The card is the office's "event in the
room" – the phone rings when one arrives.

### 3c. The headquarters building (`upgradeHq`)

Four levels, the office picture changes with each:

1. Container on a wind farm site (start)
2. Old town office floor
3. Office building
4. Glass tower with view over the sea

Each level costs money and upkeep and raises the **board limit** (level 1: one executive, … level 4: four)
and the number of decision options shown (higher levels sometimes get a third, better option). The building
also counts into the net worth with a book value. Rivals upgrade by value; the rivals' tower is visible in
the portrait wall / rival folder.

### Out of scope for now

- Supervisory board goals ("200 MW offshore by 2028" → bonus): possible later on top of 3b
- Free movement in the building / several rooms: too much drawing for little play value
- Staff below board level (head count, HR)

## Technical notes

- Office scene: `apps/web/src/scene/office.ts`, drawn in layers (wall, window with landscape crop, furniture,
  objects, people, light), reusing `effects.ts` (texture, vignette) and `palette.ts`. The HQ level picks the
  room. Hotspots are HTML buttons absolutely positioned from the same geometry the scene uses.
- Folder overlay: `ui/folder.ts`; today's `vSites`, `vMarket`, … render into it unchanged at first, then get
  the paper look step by step. `UI.tab` stays as the state of the open area so phone tabs and desktop
  folders share it.
- Engine: new actions `hireExecutive`, `fireExecutive`, `decide`, `upgradeHq`; new state `Player.board`,
  `Player.hq`, `Player.decision`; view fields for them; new events (`executiveHired`, `decisionOffered`,
  `decisionTaken`, `hqUpgraded`). All in `API.md` and `ARCHITECTURE.md` once implemented.
