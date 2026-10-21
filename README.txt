FIBBAGE XL - BEHIND THE BLUFF
Built by Dez's Minion

Start: npm start
The server listens on process.env.PORT, defaulting to 3000.
Open the server URL in your browser or the Orb preview.
No application dependencies are required.

The supplied archive contains 331 question truths and 5,966 built-in lie
suggestions. The searchable archive includes both normal and final rounds.
Select a question to inspect its complete answer and suggestions.
Export data downloads all question records as JSON.

F6 toggles the companion mod menu while this page has focus. It controls
answer/suggestion visibility and provides shortcuts to answers and players.
This is not a native game modification or a global/in-game overlay.

Connected users and player-written lies are not present in the ZIP.
The Players view supports importing an authorized host snapshot:

{
  "players": [
    {"id": "1", "name": "Dez", "score": 1000, "connected": true}
  ],
  "questionId": 14263,
  "lies": [{"text": "mimes", "playerId": "1"}]
}

Only players is required. Each player requires a unique id and a name.
Optional fields: score, connected, questionId, lies. Lie entries require
text and may specify playerId. Unknown connection states remain unknown.
Snapshots stay in the current browser tab's memory and are lost on reload.
No live connection, automatic game attachment, or network protocol is
implemented. The Archive findings view distinguishes static SWF string
evidence from confirmed runtime capabilities.

Regenerate extracted data: npm run analyze
This reads the uploaded ZIP without executing the game or changing it.
Run the included targeted checks: npm test

PASTE-IN AUTO ANSWER SELECTOR

Open fibbage-inject.js and copy its entire contents. On the game's browser
controller page, open Inspect / Developer Tools, choose Console, and paste
and run the script. Only paste code you have reviewed and trust. Do not
disable browser paste protections or other browser security features.
Use this only in a game you have permission to automate.

The script bundles all 331 truths and accepted alternate spellings. It
recognizes complete visible question text, waits for stable answer choices,
and clicks an exact, unique correct choice once per question. Player lies
and built-in decoys are not treated as truths. It never fills a lie input
or presses a separate submit/confirmation control. A dispatched click is
not proof that the game server accepted the answer.

F6 hides/shows the injected panel; hiding does not pause selection.
Use the Auto-select checkbox or these Console controls:

  fibbageMinion.pause()
  fibbageMinion.resume()
  fibbageMinion.scan()
  fibbageMinion.reset()   // allow previously answered questions again
  fibbageMinion.status
  fibbageMinion.stop()    // remove the observer, timer, hotkey and panel

If the page exposes unrelated controls or more than one question, narrow
the selectors to the game's actual DOM (replace these example selectors):

  fibbageMinion.configure({
    questionSelector: ".question-text",
    answerSelector: ".answer-options button",
    settleMs: 700
  })

The question must be present as visible text in the SAME document as the
answer buttons. If embedded in an iframe, choose that frame's Console
execution context. Canvas, video, Flash/native-game pixels, closed shadow
roots, or a controller that omits the question are not supported. There
is no OCR or native-game integration. The supplied native SWF game cannot
be automated by this browser script directly. Unrecognized or ambiguous
questions/choices are reported without guessing. Controls that reject
synthetic clicks may not work.

The script performs no fetches, installs nothing, and is removed on reload.
It is also served at /fibbage-inject.js for local download.
Regenerate after updating archive data: npm run build:injector
