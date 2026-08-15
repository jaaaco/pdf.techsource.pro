export interface Article {
  slug: string
  locale: string
  path: string
  title: string
  description: string
  date: string
  updated: string
  tags: string[]
  body: string
}

export declare const articlePath: (locale: string, slug: string) => string
export declare const toArticle: (filePath: string, source: string) => Article | null
export declare const byDateDesc: (a: Article, b: Article) => number
