import { Paper, Tag, PaperTag, UserFavorite } from "@prisma/client"

export type PaperWithTags = Paper & {
    tags: (PaperTag & { tag: Tag })[],
    favoritedBy?: UserFavorite[]
}
