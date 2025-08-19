"use server"

import { addToCartBulk } from "@/lib/data/cart"
import { HttpTypes } from "@medusajs/types"

export async function addToCartBulkAction({
  lineItems,
  countryCode,
}: {
  lineItems: HttpTypes.StoreAddCartLineItem[]
  countryCode: string
}) {
  return await addToCartBulk({ lineItems, countryCode })
}
