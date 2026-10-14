Update the supplied code map using the actual execution hook

and connected Matrix generated in this chat.



Add:

app/utils/meta-injector.execution-hook.jsx

Named export: useMetaInjectorExecution

Responsibilities: extracted execution triggers, unified dispatch

effect and unified response effect.



Update Matrix's responsibilities:

State, fetcher creation, clearBench, reference matching and

top-level coordination remain there. Extracted execution

callbacks/effects are now supplied by the hook.



Record actual config inputs and returned callbacks from the

generated source. Do not guess or invent signatures.



Preserve every other map section and verified reference ID.

Keep the unhandled-write error and unknown partial-write status open.

Telemetry reports successful reads and AI stages; this does not

verify writes, read-back or every extracted control.



Mark previous Matrix size measurements as historical.

Do not invent a new size, commit SHA or deployment result.



Return the COMPLETE updated Markdown in ONE copyable code block.

Full file only. Do not truncate. Do not summarize.



