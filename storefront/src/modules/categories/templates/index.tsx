import CategoryBreadcrumb from "@/modules/categories/category-breadcrumb"
import Button from "@/modules/common/components/button"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import SkeletonProductGrid from "@/modules/skeletons/templates/skeleton-product-grid"
import RefinementList from "@/modules/store/components/refinement-list"
import { SortOptions } from "@/modules/store/components/refinement-list/sort-products"
import PaginatedProducts from "@/modules/store/templates/paginated-products"
import { ArrowUturnLeft } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import { Container, Text } from "@medusajs/ui"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import Image from "next/image"


export default function CategoryTemplate({
  categories,
  currentCategory,
  sortBy,
  page,
  countryCode,
}: {
  categories: HttpTypes.StoreProductCategory[]
  currentCategory: HttpTypes.StoreProductCategory
  sortBy?: SortOptions
  page?: string
  countryCode: string
}) {
  const pageNumber = page ? parseInt(page) : 1
  const sort = sortBy || "created_at"

  if (!currentCategory || !countryCode) notFound()

  return (
    <div className="bg-neutral-100">
      <div
        className="flex flex-col py-6 content-container gap-4"
        data-testid="category-container"
      >
              <Container className="flex flex-col gap-2 justify-center text-center items-center text-sm text-neutral-500">
                <Text className="font-medium">
                  {currentCategory.name}
                </Text>
                <Image src={`/${currentCategory.id}.png`} alt={currentCategory.name} width="800" height="800" />
              </Container>
            {currentCategory.products?.length === 0 ? (
              <Container className="flex flex-col gap-2 justify-center text-center items-center text-sm text-neutral-500">
                <Text className="font-medium">
                  No products found for this category.
                </Text>
                <LocalizedClientLink
                  href="/store"
                  className="flex gap-2 items-center"
                >
                  <Button variant="secondary">
                    Back to all products
                    <ArrowUturnLeft className="w-4 h-4" />
                  </Button>
                </LocalizedClientLink>
              </Container>
            ) : (
              <Suspense
                fallback={
                  <SkeletonProductGrid
                    count={currentCategory.products?.length}
                  />
                }
              >
                <PaginatedProducts
                  
                  page={pageNumber}
                  categoryId={currentCategory.id}
                  countryCode={countryCode}
                />
              </Suspense>
            )}
          </div>
        </div>
    
  )
}
