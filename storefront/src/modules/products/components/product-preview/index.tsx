import { getProductPrice } from "@/lib/util/get-product-price"
import { HttpTypes } from "@medusajs/types"
import { Text, clx } from "@medusajs/ui"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import Thumbnail from "../thumbnail"
import PreviewAddToCart from "./preview-add-to-cart"
import PreviewPrice from "./price"

export default async function ProductPreview({
  product,
  isFeatured,
  region,
}: {
  product: HttpTypes.StoreProduct
  isFeatured?: boolean
  region: HttpTypes.StoreRegion
}) {
  if (!product) {
    return null
  }

  const { cheapestPrice } = getProductPrice({
    product,
  })

  const inventoryQuantity = product.variants?.reduce((acc, variant) => {
    return acc + (variant?.inventory_quantity || 0)
  }, 0)

  return (
    <div
      data-testid="product-list-item"
      className="flex flex-row items-center w-full border-b border-gray-200 py-3 px-2 bg-white hover:bg-gray-50 transition-colors"
    >
      <div className="flex flex-col flex-1 min-w-0">
        <Text className="text-ui-fg-base font-medium truncate min-w-[30px] " data-testid="product-subtitle">
          {product.subtitle || " "}
        </Text>
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <Text className="text-ui-fg-base font-medium truncate min-w-[60px] " data-testid="product-title">
          {product.options[0].values[0].value || "Epokenr"}
        </Text>
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <Text className="text-neutral-600 text-xs truncate min-w-[60px] ">
          {product.title}
        </Text>
      </div>

      {/* Price */}
      <div className="flex flex-col items-end min-w-[100px] mx-4">
        {cheapestPrice && <PreviewPrice price={cheapestPrice} />}
        <Text className="text-neutral-600 text-[0.7rem]">Excl. VAT</Text>
      </div>

      {/* Inventory */}
      <div className="flex flex-col items-end min-w-[80px] mx-4">
        <span
          className={clx({
            "text-green-500": inventoryQuantity && inventoryQuantity > 50,
            "text-orange-500":
              inventoryQuantity &&
              inventoryQuantity <= 50 &&
              inventoryQuantity > 0,
            "text-red-500": inventoryQuantity === 0,
          })}
        >
          {inventoryQuantity} left
        </span>
      </div>

      {/* Add to Cart Button */}
      <div className="flex items-center min-w-[120px] justify-end">
        <PreviewAddToCart product={product} region={region} />
      </div>
    </div>
  )
}
