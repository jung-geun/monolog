import type { GetServerSideProps } from "next"
import { getOntology } from "src/apis/ontology/getOntology"

const S_MAX = 86400

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const ontology = await getOntology()

  res.setHeader("Content-Type", "application/json; charset=utf-8")
  if (!ontology) {
    res.statusCode = 202
    res.write(JSON.stringify({ ready: false, message: "Ontology not built yet." }))
    res.end()
    return { props: {} }
  }

  res.setHeader("Cache-Control", `public, s-maxage=${S_MAX}, stale-while-revalidate=${Math.floor(S_MAX / 6)}`)
  res.write(JSON.stringify(ontology))
  res.end()

  return { props: {} }
}

const OntologyJson = () => null
export default OntologyJson
