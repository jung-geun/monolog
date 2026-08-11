import Script from "next/script"
import { useSyncExternalStore } from "react"
import { getRuntimePublicConfig, isGoogleMeasurementId } from "src/libs/runtimeConfig"

const subscribeToRuntimeConfig = () => () => {}

const getMeasurementId = () => {
  const measurementId = getRuntimePublicConfig().googleMeasurementId
  return isGoogleMeasurementId(measurementId) ? measurementId : ""
}

const GoogleAnalytics = () => {
  const measurementId = useSyncExternalStore(
    subscribeToRuntimeConfig,
    getMeasurementId,
    () => ""
  )


  return (
    <>
      {measurementId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', ${JSON.stringify(measurementId)}, { send_page_view: false });
              gtag('event', 'page_view', {
                page_location: window.location.href,
                page_path: window.location.pathname + window.location.search,
                page_title: document.title
              });
            `}
          </Script>
        </>
      )}
    </>
  )
}

export default GoogleAnalytics