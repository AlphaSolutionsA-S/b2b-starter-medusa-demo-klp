"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders, getCacheOptions } from "@/lib/data/cookies"
import { getRegion } from "@/lib/data/regions"
import { sortProducts } from "@/lib/util/sort-products"
import { SortOptions } from "@/modules/store/components/refinement-list/sort-products"
import { HttpTypes } from "@medusajs/types"

export const getProductsById = async ({
  ids,
  regionId,
}: {
  ids: string[]
  regionId: string
}) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[] }>(`/store/products`, {
      credentials: "include",
      method: "GET",
      query: {
        id: ids,
        region_id: regionId,
        fields:
          "*variants,*variants.calculated_price,*variants.inventory_quantity",
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ products }) => products)
}

export const getProductByHandle = async (handle: string, regionId: string) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[] }>(`/store/products`, {
      credentials: "include",
      method: "GET",
      query: {
        handle,
        region_id: regionId,
        fields:
          "*variants.calculated_price,+variants.inventory_quantity,+metadata,+tags",
      },
      headers,
      next,
      cache: "force-cache",
    })
    .then(({ products }) => products[0])
}

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = (_pageParam - 1) * limit
  const region = await getRegion(countryCode)

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  const next = {
    ...(await getCacheOptions("products")),
  }

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        credentials: "include",
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region.id,
          fields: "*variants.calculated_price",
          ...queryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then(({ products, count }) => {
      const nextPage = count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

/**
 * This will fetch 100 products to the Next.js cache and sort them based on the sortBy parameter.
 * It will then return the paginated products based on the page and limit parameters.
 */
export const listProductsWithSort = async ({
  page = 0,
  queryParams,
  sortBy = "created_at",
  countryCode,
}: {
  page?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
  sortBy?: SortOptions
  countryCode: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductParams
}> => {
  const limit = queryParams?.limit || 12

  const {
    response: { products, count },
  } = await listProducts({
    pageParam: 0,
    queryParams: {
      ...queryParams,
      limit: 100,
    },
    countryCode,
  })

  const sortedProducts = sortProducts(products, sortBy)

  const pageParam = (page - 1) * limit

  const nextPage = count > pageParam + limit ? pageParam + limit : null

  const paginatedProducts = sortedProducts.slice(pageParam, pageParam + limit)

  return {
    response: {
      products: paginatedProducts,
      count,
    },
    nextPage,
    queryParams,
  }
}

/**
 * Search for product variants by SKU or EAN code
 */
export const searchVariantsBySkuOrEan = async ({
  query,
  countryCode,
  limit = 10,
}: {
  query: string
  countryCode: string
  limit?: number
}): Promise<{ variant: HttpTypes.StoreProductVariant; product: HttpTypes.StoreProduct }[]> => {
  if (!query.trim()) {
    return []
  }

  const region = await getRegion(countryCode)
  if (!region) {
    return []
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    // Search products with variants that match SKU or EAN
    const { products } = await sdk.client.fetch<{ products: HttpTypes.StoreProduct[] }>(
      `/store/products`,
      {
        credentials: "include",
        method: "GET",
        query: {
          limit: 100,
          region_id: region.id,
          fields: "*variants,*variants.calculated_price,*variants.inventory_quantity",
        },
        headers,
        cache: "no-store", // Don't cache search results
      }
    )

    const results: { variant: HttpTypes.StoreProductVariant; product: HttpTypes.StoreProduct }[] = []
    
    for (const product of products) {
      if (product.variants) {
        for (const variant of product.variants) {
          // Check if SKU or EAN matches the query (case-insensitive prefix match)
          const sku = variant.sku?.toLowerCase() || ""
          const ean = variant.ean?.toLowerCase() || ""
          const searchQuery = query.toLowerCase()
          
          if (sku.startsWith(searchQuery) || ean.startsWith(searchQuery)) {
            results.push({ variant, product })
          }
          
          if (results.length >= limit) {
            return results
          }
        }
      }
    }
    
    return results
  } catch (error) {
    console.error("Error searching variants:", error)
    return []
  }
}
