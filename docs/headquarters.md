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
| Wall map of Europe (rough coastlines, the four regions marked) | Sites | own plots as company pins, flashing pin when a site needs action |
| Ticker / monitor on the wall | Power market | current price and arrow, scrolling ticker |
| Side door "Hinterzimmer" | Lobby & espionage | door ajar when a spy report is valid, light under the door when detectives are active |
| Newspaper on the desk | News | real headline of the latest event |
| Trophy shelf | Awards | one trophy per award won (3d), the annual cup largest |
| Portrait wall | Rivals | the rival CEOs in rank order |
| Window | Overview / landscape | shows the region with the largest own capacity, season and time of day |
| Smartphone on the desk | Decision cards, calls | vibrates and lights up with the caller when a decision card or a rival call comes in |
| Big stamp on the desk | End quarter | stamp animation on the quarter report |

The bank has no object in the room (a safe looked out of place in every building): it opens from the cash
figure in the top bar and from the folder tabs.

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
- Phone buzz, stamp and paper rustle through `sound.ts`, off with the sound button (a looping room sound was
  left out: it wears on the player)
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

| Executive | Department | Effect per power point (junior 1, senior 2) |
|---|---|---|
| Projektentwicklung | permits | rejection chance −5 %-points, one more survey per quarter |
| Netz & Technik | grid | cable duel time +10 % (auto duel +5 %-points), repowering −8 % |
| Handel | market | new PPA contracts +3 €/MWh, storage market spread share +8 %-points |
| Recht & Kommunikation | lobby | court damages +25 %, own tricks caught 20 % less often |

Junior: 0.5 M€ fee, 0.2 M€ salary per quarter; senior: 1.5 M€ fee, 0.45 M€ salary (`EXEC_GRADES`).
Headquarters: 0 / 4 / 12 / 30 M€, upkeep 0.05 / 0.12 / 0.25 / 0.5 M€ per quarter (`HQ_LEVELS`).

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
room" – the phone vibrates when one arrives.

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

### 3d. Awards and the annual cup

Trophies on the shelf stand for **awards**. They are recognition only, without effect on the rules, so they
need no balancing. Every company can win each award once; the first company to reach it gets the gold
version, later ones silver. Awards are checked at the end of a quarter (new step after the history step);
the newspaper reports them.

| Award | Condition |
|---|---|
| Erster Spatenstich | first own plant connected to the grid |
| Offshore-Pionier | first offshore wind farm in operation |
| Europäer | sites in all four regions |
| 500 MW | 500 MW in operation |
| Klimaschützer | 1 Mio. t CO₂ avoided |
| Speicherprofi | 1 GWh storage capacity in operation |

**Annual cup (Jahrespokal):** at the end of each game year, the company with the largest growth in net worth
over that year wins the cup of that year (ties: higher net worth). It can be won repeatedly, so a company
that is behind overall still has something to fight for each year. The awards folder shows the race for the
running year.

State: `Player.awards: { key, year, q, gold }[]` and the annual cup as key `cup` with its year; event
`awardWon`. Rivals do not change their play for awards (they just collect them); their trophies show in the
rival folder.

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
  `decisionTaken`, `hqUpgraded`, `awardWon`). All in `API.md` and `ARCHITECTURE.md` once implemented.
