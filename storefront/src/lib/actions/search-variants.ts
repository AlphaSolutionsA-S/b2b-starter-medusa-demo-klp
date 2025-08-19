"use server"

import { searchVariantsBySkuOrEan } from "@/lib/data/products"

export async function searchVariantsAction({
  query,
  countryCode,
  limit = 10,
}: {
  query: string
  countryCode: string
  limit?: number
}) {
  return await searchVariantsBySkuOrEan({ query, countryCode, limit })
}
