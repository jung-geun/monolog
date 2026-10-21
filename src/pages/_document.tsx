import Document, { Html, Head, Main, NextScript } from "next/document"
import Script from "next/script"
import { CONFIG } from "site.config"
import { canLoadAdSense } from "src/components/AdSlot/policy"
import { getRuntimePublicConfigFromEnvironment } from "src/libs/runtimeConfigServer"
import { getColorThemeBootstrap, getColorThemeCSS, getColorThemePreference, resolveColorTheme } from "src/styles/colors"

class MyDocument extends Document {
  render() {
    const { googleSiteVerification, naverSiteVerification, bingSiteVerification } =
      getRuntimePublicConfigFromEnvironment()

    return (
      <Html lang={CONFIG.lang}>
        <Head>
          <meta name="color-scheme" content="dark light" />
          <meta name="theme-color" content={resolveColorTheme(getColorThemePreference(CONFIG.blog.theme)).editor.bg2} />
          <style id="tablog-color-themes" dangerouslySetInnerHTML={{ __html: getColorThemeCSS(CONFIG.blog.theme) }} />
          <script id="tablog-theme-bootstrap" dangerouslySetInnerHTML={{ __html: getColorThemeBootstrap(CONFIG.blog.theme) }} />
          <link rel="icon" href="/favicon.ico" />
          <link
            rel="apple-touch-icon"
            sizes="192x192"
            href="/apple-touch-icon.png"
          ></link>
          <Script src="/runtime-config.js" strategy="beforeInteractive" />
          {canLoadAdSense(CONFIG.googleAdsense) && (
            <script
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CONFIG.googleAdsense.config.client}`}
              crossOrigin="anonymous"
            />
          )}
          {googleSiteVerification && (
            <meta
              name="google-site-verification"
              content={googleSiteVerification}
            />
          )}
          {naverSiteVerification && (
            <meta
              name="naver-site-verification"
              content={naverSiteVerification}
            />
          )}
          {bingSiteVerification && (
            <meta name="msvalidate.01" content={bingSiteVerification} />
          )}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
