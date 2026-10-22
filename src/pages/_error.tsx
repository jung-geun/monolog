import type { NextPage } from "next"
import ErrorPage from "src/routes/Error"

type Props = { statusCode: number | null }

const RuntimeErrorPage: NextPage<Props> = ({ statusCode }) => <ErrorPage statusCode={statusCode} />

RuntimeErrorPage.getInitialProps = ({ res, err }) => ({
  statusCode: res && res.statusCode >= 400
    ? res.statusCode
    : err?.statusCode ?? null,
})

export default RuntimeErrorPage
