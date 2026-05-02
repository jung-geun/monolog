import { CONFIG } from "site.config"
import { useCallback, useEffect, useState, useRef } from "react"
import styled from "@emotion/styled"
import useScheme from "src/hooks/useScheme"
import { useRouter } from "next/router"

declare global {
  interface Window {
    Cusdis: any
  }
}

type Props = {
  id: string
  slug: string
  title: string
}

const Cusdis: React.FC<Props> = ({ id, slug, title }) => {
  const [value, setValue] = useState(0)
  const [scheme] = useScheme()
  const cusdisRef = useRef<HTMLDivElement>(null)

  const loadCusdisScript = useCallback(() => {
    // Load Cusdis script if not already loaded
    if (!window.Cusdis) {
      const script = document.createElement('script')
      script.src = 'https://cusdis.com/js/cusdis.es.js'
      script.async = true
      document.head.appendChild(script)
      
      script.onload = () => {
        // Initialize Cusdis after script loads
        if (window.Cusdis && cusdisRef.current) {
          window.Cusdis.render()
        }
      }
    } else {
      // Re-render Cusdis if script is already loaded
      if (window.Cusdis && cusdisRef.current) {
        window.Cusdis.render()
      }
    }
  }, [])

  const onDocumentElementChange = useCallback(() => {
    setValue((value) => value + 1)
  }, [])

  useEffect(() => {
    const changesObserver = new MutationObserver(
      (mutations: MutationRecord[]) => {
        mutations.forEach((mutation: MutationRecord) => {
          onDocumentElementChange()
        })
      }
    )

    changesObserver.observe(document.documentElement, {
      attributeFilter: ["class"],
    })

    return () => {
      changesObserver.disconnect()
    }
  }, [onDocumentElementChange])

  useEffect(() => {
    // Load and initialize Cusdis
    loadCusdisScript()
  }, [loadCusdisScript, value])

  return (
    <>
      <StyledWrapper id="comments">
        <div
          ref={cusdisRef}
          id="cusdis_thread"
          data-host={CONFIG.cusdis.config.host}
          data-app-id={CONFIG.cusdis.config.appid}
          data-page-id={id}
          data-page-url={`${CONFIG.link}/${slug}`}
          data-page-title={title}
          data-theme={scheme}
        />
      </StyledWrapper>
    </>
  )
}

export default Cusdis

const StyledWrapper = styled.div`
  margin-top: 2.5rem;
`
