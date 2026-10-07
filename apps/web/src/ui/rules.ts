/** The rules sheet: explains the game once, like the rule booklet in a board game box. */
import { openModal } from '../modal.js';

const RULES: [string, string][] = [
  [
    'Ziel',
    'Führe deinen Energiekonzern durch die Energiewende. Nach 3, 5 oder 10 Jahren gewinnt das größte Vermögen: Kasse minus Kredit plus der Wert deiner Flächen, Kraftwerke und der Zentrale.',
  ],
  [
    'Ein Quartal',
    'Jede Runde ist ein Quartal. Handle so oft du willst, dann klickst du auf „Quartal beenden“. Danach ziehen die drei Rivalen, die Kraftwerke liefern Strom, und der Vorstand legt dir den Quartalsbericht vor.',
  ],
  [
    'Vom Acker zum Kraftwerk',
    'Erkunden zeigt Wind, Sonne und Wasser einer Fläche. Dann pachten, eine Genehmigung für Kraftwerkstyp und Größe beantragen (die Behörde kann ablehnen), bauen und ans Netz anschließen. Erst am Netz verdient ein Kraftwerk Geld. Netzkapazität ist pro Region knapp – wird es eng, kommt es zum Kabelduell mit einem Rivalen.',
  ],
  [
    'Geld',
    'Strom geht zum Börsenpreis weg, der mit Jahreszeit und Nachrichten schwankt. PPA-Verträge sichern einen festen Preis, verpflichten dich aber zur Lieferung. Speicher kaufen billig und verkaufen teuer. Die Bank leiht dir Geld bis zu einem Rahmen, der mit deinen Anlagen und deinem Stromerlös wächst; wer weit hinten liegt, bekommt einen Förderkredit dazu. Reicht er bei leerer Kasse nicht mehr, bist du insolvent.',
  ],
  [
    'Konkurrenz',
    'Die Rivalen spielen nach denselben Regeln wie du. Im Hinterzimmer spionierst du sie aus und schadest ihnen dann mit Klagen, Bürgerinitiativen oder Hackern. Wer auffliegt, zahlt Strafe und Schadensersatz. Detektive schützen dich vor solchen Tricks.',
  ],
  [
    'Dein Büro',
    'Stell Vorstände ein, die gegen Gehalt einen Bereich stärken. Anrufe und Post verlangen Entscheidungen – triffst du keine, gilt am Quartalsende die Standardwahl. Eine größere Zentrale bietet Platz für mehr Vorstände. Für Meilensteine gibt es Auszeichnungen, für das stärkste Jahreswachstum den Pokal.',
  ],
  [
    'Minispiele',
    'Beim Bau, beim Netzanschluss und bei Reparaturen entscheiden Minispiele über Leistung und Erfolg. Wer sie beim Start abwählt, bekommt ein ausgewürfeltes Ergebnis.',
  ],
];

/** Opens the rules sheet; `back` names the action of the button that leaves it. */
export function showRules(back: 'closeModal' | 'rulesBack'): void {
  openModal(
    `<article class="paper rules"><div class="mast"><h2>SPIELREGELN</h2></div>
    ${RULES.map(([h, t]) => `<section><h3>${h}</h3><p>${t}</p></section>`).join('')}</article>
    <div class="foot"><button class="btn primary" data-act="${back}">${back === 'rulesBack' ? '← Zurück' : 'Verstanden'}</button></div>`,
    { wide: true },
  );
}
