import Document, { Html, Head, Main, NextScript } from "next/document"
import Script from "next/script"
import { CONFIG } from "site.config"
import { getRuntimePublicConfigFromEnvironment } from "src/libs/runtimeConfigServer"

class MyDocument extends Document {
  render() {
    const { googleSiteVerification, naverSiteVerification, bingSiteVerification } =
      getRuntimePublicConfigFromEnvironment()

    return (
      <Html lang={CONFIG.lang}>
        <Head>
          <meta name="color-scheme" content="dark light" />
          <meta name="theme-color" content="#0e0f13" media="(prefers-color-scheme: dark)" />
          <meta name="theme-color" content="#fbfaf6" media="(prefers-color-scheme: light)" />
          <link rel="icon" href="/favicon.ico" />
          <link
            rel="apple-touch-icon"
            sizes="192x192"
            href="/apple-touch-icon.png"
          ></link>
          <Script src="/runtime-config.js" strategy="beforeInteractive" />
          {CONFIG.googleAdsense?.enable && CONFIG.googleAdsense.config.client && (
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
