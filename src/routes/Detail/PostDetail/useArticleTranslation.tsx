import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { CONFIG } from "site.config"
import { createTranslationPlan, type TranslationArticle } from "./articleTranslation"
import ArticleTranslationControls from "./ArticleTranslationControls"

type LanguagePair = { sourceLanguage: string; targetLanguage: string }
type Availability = "available" | "downloadable" | "downloading" | "unavailable"
type BrowserTranslator = {
  translate: (text: string, options: { signal: AbortSignal }) => Promise<string>
  destroy: () => void
}
type TranslatorAPI = {
  availability: (options: LanguagePair) => Promise<Availability>
  create: (options: LanguagePair & {
    signal: AbortSignal
    monitor: (monitor: {
      addEventListener: (type: "downloadprogress", listener: (event: { loaded: number }) => void, options: { signal: AbortSignal }) => void
    }) => void
  }) => Promise<BrowserTranslator>
}
type Context = { original: TranslationArticle; slug: string | undefined; source: string; target: string }
type Job = { context: Context; controller: AbortController; translator: BrowserTranslator | null }
type Snapshot = {
  context: Context
  article: TranslationArticle
  phase: "preparing" | "translating" | "complete" | "cancelled" | "error"
  completed: number
  total: number
  downloadProgress: number | null
  error: string
}

const validateLanguage = (value: string) => {
  try {
    const language = Intl.getCanonicalLocales(value.trim())[0]
    if (language) return { language, error: "" }
  } catch {
    // Invalid tags are reported beside the editable field, never sent to the API.
  }
  return { language: "", error: "Enter a valid BCP 47 language tag, such as ko or en." }
}

const disposeJob = (job: Job) => {
  const translator = job.translator
  job.translator = null
  job.controller.abort()
  // Aborting create's signal can already destroy the instance in native implementations.
  try { translator?.destroy() } catch { /* Resource cleanup must not prevent cancellation. */ }
}

const translationError = (error: unknown) => {
  const name = error instanceof Error ? error.name : ""
  if (name === "NotAllowedError") return "Translation was not allowed. Check this page’s browser permissions and try Translate article again."
  if (name === "NotSupportedError") return "The browser cannot translate this language pair. Choose another source or target language."
  if (name === "NetworkError") return "The browser could not download its translation model. Check your connection and try again."
  if (name === "QuotaExceededError") return "A sentence exceeds the browser’s translation limit. Any completed translations remain visible; you can restore the original."
  return "Translation failed. Any completed translations remain visible. Try again or restore the original."
}

/** Only the explicit Translate article action creates a model or translates text. */
const useArticleTranslation = (article: TranslationArticle, slug: string | undefined) => {
  const original = useMemo(() => ({ title: article.title, summary: article.summary, recordMap: article.recordMap }), [article.title, article.summary, article.recordMap])
  const [sourceInput, setSourceInput] = useState(CONFIG.lang || "ko")
  const [targetInput, setTargetInput] = useState("")
  const [browser, setBrowser] = useState<{ detected: boolean; api: TranslatorAPI | null }>({ detected: false, api: null })
  const [availability, setAvailability] = useState<{ source: string; target: string; status: Availability | "error"; error: string } | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const mounted = useRef(false)
  const job = useRef<Job | null>(null)
  const source = validateLanguage(sourceInput)
  const target = validateLanguage(targetInput)
  const context = useMemo(() => ({ original, slug, source: sourceInput, target: targetInput }), [original, slug, sourceInput, targetInput])
  const latest = useRef(context)

  const stop = useCallback(() => {
    const pending = job.current
    job.current = null
    if (pending) disposeJob(pending)
  }, [])

  useEffect(() => {
    mounted.current = true
    // Detection is deliberately mount-only: no UA sniffing, SSR API access, or model creation.
    // The experimental Translator API is not yet included in this project's DOM typings.
    const scope = globalThis as typeof globalThis & { Translator?: TranslatorAPI }
    const candidate = scope.Translator
    const api = candidate && typeof candidate.availability === "function" && typeof candidate.create === "function" ? candidate : null
    setBrowser({ detected: true, api })
    setTargetInput(navigator.language)
    return () => {
      mounted.current = false
      stop()
    }
  }, [stop])

  useLayoutEffect(() => {
    latest.current = context
    return () => {
      if (job.current?.context === context) stop()
    }
  }, [context, stop])
  useEffect(() => {
    const api = browser.api
    if (!api || !source.language || !target.language || source.language === target.language) return
    let stale = false
    const pair = { sourceLanguage: source.language, targetLanguage: target.language }
    // availability checks language-pack support only; it does not create or download a model.
    const check = async () => {
      try {
        const status = await api.availability(pair)
        if (stale) return
        if (!["available", "downloadable", "downloading", "unavailable"].includes(status)) throw new Error("Unknown availability")
        setAvailability({ source: pair.sourceLanguage, target: pair.targetLanguage, status, error: "" })
      } catch {
        if (!stale) setAvailability({ source: pair.sourceLanguage, target: pair.targetLanguage, status: "error", error: "The browser could not check this language pair. Change a language to check again." })
      }
    }
    void check()
    return () => { stale = true }
  }, [browser.api, source.language, target.language])

  // A new article/config must NEVER render an old article, even before effect cleanup.
  const visible = snapshot?.context === context ? snapshot : null
  const matchingAvailability = availability?.source === source.language && availability.target === target.language ? availability : null
  const canTranslate = Boolean(browser.api && source.language && target.language && source.language !== target.language && matchingAvailability && ["available", "downloadable", "downloading"].includes(matchingAvailability.status))
  const busy = visible?.phase === "preparing" || visible?.phase === "translating"
  const hasTranslation = Boolean(visible && visible.completed > 0)

  const changeLanguage = (value: string, which: "source" | "target") => {
    if (value === (which === "source" ? sourceInput : targetInput)) return
    stop()
    setSnapshot(null)
    if (which === "source") setSourceInput(value)
    else setTargetInput(value)
  }

  const restore = () => {
    stop()
    setSnapshot(null)
  }

  const cancel = () => {
    stop()
    setSnapshot(current => current?.context === context ? { ...current, phase: "cancelled", downloadProgress: null, error: "" } : null)
  }

  const translate = async () => {
    const api = browser.api
    // Ref locking is synchronous: repeated clicks before React renders cannot start a second job.
    if (!mounted.current || job.current || !canTranslate || !api) return
    const pending: Job = { context, controller: new AbortController(), translator: null }
    job.current = pending
    const isCurrent = () => mounted.current && job.current === pending && latest.current === context && !pending.controller.signal.aborted
    let next: Snapshot = { context, article: original, phase: "preparing", completed: 0, total: 0, downloadProgress: null, error: "" }
    const publish = (patch: Partial<Snapshot>) => {
      if (!isCurrent()) return
      next = { ...next, ...patch }
      setSnapshot(next)
    }
    publish({})
    try {
      const plan = createTranslationPlan(original, source.language)
      if (!plan.texts.length) {
        publish({ phase: "complete" })
        return
      }
      // No await before create: preserve transient activation from the user's click.
      const translator = await api.create({
        sourceLanguage: source.language,
        targetLanguage: target.language,
        signal: pending.controller.signal,
        monitor: monitor => {
          if (!isCurrent()) return
          monitor.addEventListener("downloadprogress", event => {
            if (Number.isFinite(event.loaded)) publish({ downloadProgress: Math.max(0, Math.min(1, event.loaded)) })
          }, { signal: pending.controller.signal })
        },
      })
      // A browser may ignore abort while creating. Never leak or use a late instance.
      if (!isCurrent()) {
        try { translator.destroy() } catch { /* It may already have been aborted. */ }
        return
      }
      pending.translator = translator
      publish({ phase: "translating", total: plan.texts.length, downloadProgress: null })
      const translations = new Map<number, string>()
      for (let index = 0; index < plan.texts.length; index += 1) {
        if (!isCurrent()) return
        const text = await translator.translate(plan.texts[index], { signal: pending.controller.signal })
        if (!isCurrent()) return
        if (!text.trim()) throw new Error("The browser returned an empty translation")
        translations.set(index, text)
        publish({ article: plan.apply(translations), completed: index + 1 })
      }
      publish({ phase: "complete" })
    } catch (error) {
      if (isCurrent()) publish({ phase: "error", downloadProgress: null, error: translationError(error) })
    } finally {
      if (job.current === pending) job.current = null
      disposeJob(pending)
    }
  }

  let availabilityMessage = "Checking browser translation support…"
  if (browser.detected && !browser.api) availabilityMessage = "This browser does not expose the built-in Translator API. Translation is unavailable here; use a browser with this API enabled in a secure context. The original article remains available, and no cloud translation fallback is used."
  else if (source.error || target.error) availabilityMessage = "Enter valid source and target language tags to check browser support."
  else if (source.language === target.language) availabilityMessage = "Choose different source and target languages."
  else if (matchingAvailability?.status === "unavailable") availabilityMessage = "Your browser does not support this language pair. Choose another source or target language."
  else if (matchingAvailability?.status === "available") availabilityMessage = "The browser’s translation model is ready. Translation starts only when you choose Translate article."
  else if (matchingAvailability?.status === "downloadable") availabilityMessage = "The browser needs to download a language model. Choose Translate article to allow the browser to prepare it."
  else if (matchingAvailability?.status === "downloading") availabilityMessage = "The browser is downloading this language model. Choose Translate article to wait for it and begin translation."
  else if (matchingAvailability?.status === "error") availabilityMessage = matchingAvailability.error
  else if (browser.api) availabilityMessage = "Checking support for this language pair…"

  let status = ""
  if (visible?.phase === "preparing") status = visible.downloadProgress === null ? "Preparing the browser translation model…" : `Downloading translation model: ${Math.round(visible.downloadProgress * 100)}%.`
  else if (visible?.phase === "translating") status = `Translated ${visible.completed} of ${visible.total} sentences. Unfinished sentences remain original.`
  else if (visible?.phase === "cancelled") status = visible.completed ? `Translation cancelled after ${visible.completed} of ${visible.total} sentences. Partial translation remains; choose Restore original to undo it.` : "Translation cancelled. The original article is unchanged."
  else if (visible?.phase === "complete") status = visible.total ? `Translation complete: ${visible.completed} sentences. Source stays original.` : "No translatable article text was found."

  const controls = <ArticleTranslationControls
    sourceLanguage={sourceInput}
    targetLanguage={targetInput}
    onSourceChange={value => changeLanguage(value, "source")}
    onTargetChange={value => changeLanguage(value, "target")}
    onTranslate={() => { void translate() }}
    onCancel={cancel}
    onRestore={restore}
    busy={busy}
    hasTranslation={hasTranslation}
    canTranslate={canTranslate}
    sourceError={source.error}
    targetError={browser.detected ? target.error : ""}
    availabilityMessage={availabilityMessage}
    status={status}
    error={visible?.error || ""}
    completed={visible?.completed || 0}
    total={visible?.total || 0}
    downloadProgress={visible?.downloadProgress ?? null}
  />

  return { article: visible?.article ?? original, controls, active: hasTranslation, targetLanguage: target.language || undefined }
}

export default useArticleTranslation
