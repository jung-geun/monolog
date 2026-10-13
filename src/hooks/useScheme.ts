import useColorTheme from "./useColorTheme"
import { SchemeType } from "src/types"

// Compatibility for binary-only integrations such as Notion and comments.
// Visitor preferences belong to useColorTheme, never this derived scheme.
const useScheme = (): [SchemeType] => [useColorTheme().theme.scheme]

export default useScheme
