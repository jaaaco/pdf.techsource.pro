export interface FrontMatterResult {
  data: Record<string, string | string[]>
  body: string
}

export declare const parseFrontMatter: (source: string) => FrontMatterResult

export default parseFrontMatter
