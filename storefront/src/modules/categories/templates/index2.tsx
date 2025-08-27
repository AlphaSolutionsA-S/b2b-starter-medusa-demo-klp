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


export default function CategoryTemplate2({
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
              <Container className="flex flex-col gap-4 justify-center items-center text-sm text-neutral-500">
                <Text className="font-medium">
                  {currentCategory.name}
                </Text>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                  {currentCategory.category_children?.map(child => (
                    <LocalizedClientLink key={child.id} href={`/categories/${child.handle}`} className="flex flex-col items-center gap-2 p-4 border rounded-lg bg-white hover:shadow-lg transition-shadow">
                      <Text className="font-semibold text-base text-center underline text-blue-600">{child.name}</Text>
                      <Image src={`/${child.id}.png`} alt={child.name} width={200} height={200} className="object-contain rounded" />
                    </LocalizedClientLink>
                  ))}
                </div>
              </Container>
            
          </div>
        </div>
    
  )
}
