"use client"

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from "react"
import { HttpTypes } from "@medusajs/types"
import { searchVariantsAction } from "@/lib/actions/search-variants"
import { addToCartBulkAction } from "@/lib/actions/add-to-cart-bulk"
import Button from "@/modules/common/components/button"
import { useParams, useRouter } from "next/navigation"
import { clx } from "@medusajs/ui"

interface QuickOrderItem {
  id: string
  sku: string
  quantity: number
  variantId?: string
  variantName?: string
  variantEan?: string
  isValid: boolean
}

interface VariantSearchResult {
  variant: HttpTypes.StoreProductVariant
  product: HttpTypes.StoreProduct
}

const QuickOrder = () => {
  const [items, setItems] = useState<QuickOrderItem[]>([
    { id: "1", sku: "", quantity: 1, isValid: false }
  ])
  const [searchResults, setSearchResults] = useState<Record<string, VariantSearchResult[]>>({})
  const [selectedIndices, setSelectedIndices] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const params = useParams()
  const router = useRouter()
  const countryCode = params.countryCode as string
  
  // Refs for input fields
  const skuInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string, itemId: string) => {
      if (query.trim().length > 0) {
        setIsLoading(true)
        try {
          const results = await searchVariantsAction({
            query: query.trim(),
            countryCode,
            limit: 10
          })
          setSearchResults(prev => ({ ...prev, [itemId]: results }))
        } catch (error) {
          console.error("Search error:", error)
          setSearchResults(prev => ({ ...prev, [itemId]: [] }))
        } finally {
          setIsLoading(false)
        }
      } else {
        setSearchResults(prev => ({ ...prev, [itemId]: [] }))
      }
    }, 300),
    [countryCode]
  )

  // Handle SKU/EAN input change
  const handleSkuChange = (itemId: string, value: string) => {
    const wasExactMatch = items.find(item => item.id === itemId)?.isValid || false
    
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item, sku: value, variantId: undefined, variantName: undefined, variantEan: undefined, isValid: false }
        
        // Check if the value matches any exact SKU/EAN
        const currentResults = searchResults[itemId] || []
        const exactMatch = currentResults.find(result => 
          result.variant.sku === value || result.variant.ean === value
        )
        
        if (exactMatch) {
          // Focus quantity field when exact match is found
          if (!wasExactMatch) {
            focusQuantityField(itemId)
          }
          
          return {
            ...updatedItem,
            sku: value, // Keep the exact value that was entered
            variantId: exactMatch.variant.id,
            variantName: exactMatch.product.title + (exactMatch.variant.title ? ` - ${exactMatch.variant.title}` : ""),
            variantEan: exactMatch.variant.ean || undefined,
            isValid: true
          }
        }
        
        return updatedItem
      }
      return item
    }))

    // Trigger search for partial matches
    debouncedSearch(value, itemId)
  }

  // Handle keyboard navigation in search results
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, itemId: string) => {
    const results = searchResults[itemId] || []
    const currentIndex = selectedIndices[itemId] ?? -1
    
    if (results.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        const nextIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0
        setSelectedIndices(prev => ({ ...prev, [itemId]: nextIndex }))
        break
        
      case 'ArrowUp':
        e.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1
        setSelectedIndices(prev => ({ ...prev, [itemId]: prevIndex }))
        break
        
      case 'Enter':
        e.preventDefault()
        if (currentIndex >= 0 && results[currentIndex]) {
          selectVariant(itemId, results[currentIndex])
        }
        break
        
      case 'Tab':
        // Auto-complete with first entry if there are results
        if (results.length > 0) {
          e.preventDefault()
          selectVariant(itemId, results[0])
        }
        break
        
      case 'Escape':
        e.preventDefault()
        setSearchResults(prev => ({ ...prev, [itemId]: [] }))
        setSelectedIndices(prev => ({ ...prev, [itemId]: -1 }))
        break
    }
  }

  // Focus quantity field when SKU/EAN is completed
  const focusQuantityField = (itemId: string) => {
    setTimeout(() => {
      const quantityInput = quantityInputRefs.current[itemId]
      if (quantityInput) {
        quantityInput.focus()
        quantityInput.select()
      }
    }, 100)
  }

  // Handle quantity change
  const handleQuantityChange = (itemId: string, quantity: number) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item
    ))
  }

  // Select a variant from search results
  const selectVariant = (itemId: string, result: VariantSearchResult) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // Determine which field (SKU or EAN) matches the current input
        const currentInput = item.sku.toLowerCase()
        const sku = result.variant.sku?.toLowerCase() || ""
        const ean = result.variant.ean?.toLowerCase() || ""
        
        // Choose the field that the user was actually typing
        let completedValue = ""
        if (sku.startsWith(currentInput) && currentInput.length > 0) {
          completedValue = result.variant.sku || ""
        } else if (ean.startsWith(currentInput) && currentInput.length > 0) {
          completedValue = result.variant.ean || ""
        } else {
          // Fallback to SKU if no clear match
          completedValue = result.variant.sku || result.variant.ean || ""
        }
        
        return {
          ...item,
          sku: completedValue,
          variantId: result.variant.id,
          variantName: result.product.title + (result.variant.title ? ` - ${result.variant.title}` : ""),
          variantEan: result.variant.ean || undefined,
          isValid: true
        }
      }
      return item
    }))
    
    // Clear search results and selection for this item
    setSearchResults(prev => ({ ...prev, [itemId]: [] }))
    setSelectedIndices(prev => ({ ...prev, [itemId]: -1 }))
    
    // Focus quantity field
    focusQuantityField(itemId)
  }

  // Add new line when both SKU and quantity are filled
  useEffect(() => {
    const lastItem = items[items.length - 1]
    if (lastItem.isValid && lastItem.quantity > 0) {
      const newId = Date.now().toString()
      setItems(prev => [...prev, { id: newId, sku: "", quantity: 1, isValid: false }])
    }
  }, [items])

  // Clear all items
  const clearAll = () => {
    setItems([{ id: Date.now().toString(), sku: "", quantity: 1, isValid: false }])
    setSearchResults({})
  }

  // Add to cart
  const addToCart = async () => {
    const validItems = items.filter(item => item.isValid && item.variantId)
    
    if (validItems.length === 0) {
      return
    }

    setIsSubmitting(true)
    try {
      const lineItems = validItems.map(item => ({
        variant_id: item.variantId!,
        quantity: item.quantity
      }))

      await addToCartBulkAction({ lineItems, countryCode })
      
      // Clear form after successful submission
      clearAll()
      
      // You might want to show a success message or redirect
      router.refresh()
    } catch (error) {
      console.error("Error adding to cart:", error)
      // You might want to show an error message
    } finally {
      setIsSubmitting(false)
    }
  }

  const validItemsCount = items.filter(item => item.isValid).length

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-4">Quick Order</h2>
      
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={item.id} className="relative">
            <div className="grid grid-cols-12 gap-4 items-start">
              {/* SKU/EAN Input */}
              <div className="col-span-4 relative">
                <input
                  ref={(el) => { skuInputRefs.current[item.id] = el }}
                  type="text"
                  value={item.sku}
                  onChange={(e) => handleSkuChange(item.id, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, item.id)}
                  placeholder="Enter SKU or EAN"
                  className={clx(
                    "w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                    item.isValid ? "border-green-500 bg-green-50" : "border-gray-300"
                  )}
                />
                
                {/* Search dropdown */}
                {searchResults[item.id] && searchResults[item.id].length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchResults[item.id].map((result, resultIndex) => (
                      <div
                        key={resultIndex}
                        onClick={() => selectVariant(item.id, result)}
                        className={clx(
                          "px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0",
                          selectedIndices[item.id] === resultIndex 
                            ? "bg-blue-100 hover:bg-blue-200" 
                            : "hover:bg-gray-100"
                        )}
                      >
                        <div className="font-medium text-sm">{result.variant.sku || result.variant.ean}</div>
                        <div className="text-xs text-gray-600">
                          {result.product.title}{result.variant.title ? ` - ${result.variant.title}` : ""}
                        </div>
                        {result.variant.ean && (
                          <div className="text-xs text-gray-500 mt-1">
                            EAN: {result.variant.ean}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Label/Product Name */}
              <div className="col-span-6 flex items-center px-2 h-10">
                <div className="flex flex-col justify-center">
                  <span className="text-sm text-gray-600 break-words leading-tight">
                    {item.variantName || "Product"}
                  </span>
                  {item.variantEan && (
                    <span className="text-xs text-gray-500 leading-tight">
                      EAN: {item.variantEan}
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity Input */}
              <div className="col-span-2">
                <input
                  ref={(el) => { quantityInputRefs.current[item.id] = el }}
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                  placeholder="Qty"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex justify-between items-center mt-6">
        <Button
          variant="secondary"
          onClick={clearAll}
          disabled={isSubmitting}
        >
          Clear All
        </Button>
        
        <div className="flex items-center gap-4">
          {validItemsCount > 0 && (
            <span className="text-sm text-gray-600">
              {validItemsCount} item{validItemsCount !== 1 ? 's' : ''} ready
            </span>
          )}
          <Button
            onClick={addToCart}
            disabled={validItemsCount === 0 || isSubmitting}
          >
            {isSubmitting ? "Adding..." : "Add to Cart"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export default QuickOrder
