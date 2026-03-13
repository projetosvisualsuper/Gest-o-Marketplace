/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { Calculator, Package, Tag, Weight, Percent, DollarSign, Trash2, Plus, Info, Upload, Search, Download, BarChart3, X, FileText, ChevronDown, ChevronUp, ReceiptText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { SHIPPING_RATES, PRICE_RANGES, SHOPEE_RULES } from './constants';

interface Product {
  id: string;
  adId?: string;
  sku: string;
  name: string;
  price: number;
  costPrice: number;
  weight: number;
  adType: 'classic' | 'premium' | 'shopee';
  marketplace: 'mercadolivre' | 'shopee';
  margin: number;
  originalPrice?: number;
  originalAdType?: 'classic' | 'premium' | 'shopee';
}

export default function App() {
  const [sku, setSku] = useState('');
  const [adId, setAdId] = useState('');
  const [name, setName] = useState('');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [margin, setMargin] = useState<number | ''>('');
  const [priceMode, setPriceMode] = useState<'direct' | 'margin'>('direct');
  const [weight, setWeight] = useState<number | ''>('');
  const [adType, setAdType] = useState<'classic' | 'premium'>('classic');
  const [marketplace, setMarketplace] = useState<'mercadolivre' | 'shopee'>('mercadolivre');
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('marketplace_products');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [summaryFilter, setSummaryFilter] = useState<'all' | 'mercadolivre' | 'shopee'>('all');
  const [adTypeFilter, setAdTypeFilter] = useState<'all' | 'classic' | 'premium'>('all');
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showBelowTargetOnly, setShowBelowTargetOnly] = useState(false);
  const [targetCompanyMargin, setTargetCompanyMargin] = useState<number>(() => {
    const saved = localStorage.getItem('marketplace_target_margin');
    return saved ? Number(saved) : 20;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatMoney = (value: number) => {
    return value.toFixed(2).replace('.', ',');
  };

  React.useEffect(() => {
    localStorage.setItem('marketplace_products', JSON.stringify(products));
  }, [products]);

  React.useEffect(() => {
    localStorage.setItem('marketplace_target_margin', targetCompanyMargin.toString());
  }, [targetCompanyMargin]);

  const calculateShipping = (p: number, w: number) => {
    const priceIndex = PRICE_RANGES.findIndex(range => p >= range.min && p <= range.max);
    if (priceIndex === -1) return 0;
    const rate = SHIPPING_RATES.find(r => w >= r.minWeight && w < r.maxWeight);
    if (!rate) {
      const lastRate = SHIPPING_RATES[SHIPPING_RATES.length - 1];
      return lastRate.costs[priceIndex];
    }
    return rate.costs[priceIndex];
  };

  const calculateShopeeCost = (p: number) => {
    const rule = SHOPEE_RULES.find(r => p >= r.min && p <= r.max);
    if (!rule) {
      const lastRule = SHOPEE_RULES[SHOPEE_RULES.length - 1];
      return (p * lastRule.percent) + lastRule.fixed;
    }
    return (p * rule.percent) + rule.fixed;
  };

  const calculateSalePriceFromMargin = (cost: number, targetMargin: number, mkt: 'mercadolivre' | 'shopee', weightVal: number, type: 'classic' | 'premium') => {
    const marginDecimal = targetMargin / 100;
    
    if (mkt === 'shopee') {
      for (const rule of SHOPEE_RULES) {
        const denominator = 1 - rule.percent - marginDecimal;
        if (denominator <= 0) continue;
        const s = (cost + rule.fixed) / denominator;
        if (s >= rule.min && s <= rule.max) return s;
      }
      const lastRule = SHOPEE_RULES[SHOPEE_RULES.length - 1];
      const den = 1 - lastRule.percent - marginDecimal;
      return den > 0 ? (cost + lastRule.fixed) / den : 0;
    } else {
      const commPercent = type === 'premium' ? 0.17 : 0.12;
      for (let i = 0; i < PRICE_RANGES.length; i++) {
        const range = PRICE_RANGES[i];
        const rate = SHIPPING_RATES.find(r => weightVal >= r.minWeight && weightVal < r.maxWeight) || SHIPPING_RATES[SHIPPING_RATES.length - 1];
        const shipping = rate.costs[i];
        const denominator = 1 - commPercent - marginDecimal;
        if (denominator <= 0) continue;
        const s = (cost + shipping) / denominator;
        if (s >= range.min && s <= range.max) return s;
      }
      const lastRate = SHIPPING_RATES.find(r => weightVal >= r.minWeight && weightVal < r.maxWeight) || SHIPPING_RATES[SHIPPING_RATES.length - 1];
      const den = 1 - commPercent - marginDecimal;
      return den > 0 ? (cost + lastRate.costs[PRICE_RANGES.length - 1]) / den : 0;
    }
  };

  const currentCalculation = useMemo(() => {
    let finalPrice = price;
    let finalMargin = margin;

    if (priceMode === 'margin') {
      if (costPrice === '' || margin === '') return null;
      if (marketplace === 'mercadolivre' && weight === '') return null;
      finalPrice = calculateSalePriceFromMargin(Number(costPrice), Number(margin), marketplace, Number(weight), adType);
    } else {
      if (price === '') return null;
      finalPrice = Number(price);
    }

    if (marketplace === 'mercadolivre') {
      if (weight === '') return null;
      const adFeePercent = adType === 'premium' ? 0.17 : 0.12;
      const adFee = finalPrice * adFeePercent;
      const shippingCost = calculateShipping(finalPrice, Number(weight));
      const totalCost = adFee + shippingCost;
      const netValue = finalPrice - totalCost;
      const profit = costPrice !== '' ? netValue - Number(costPrice) : 0;
      const calculatedMargin = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;

      const breakEven = calculateSalePriceFromMargin(Number(costPrice), 0, marketplace, Number(weight), adType);

      return {
        price: finalPrice,
        adFee,
        shippingCost,
        totalCost,
        netValue,
        profit,
        margin: priceMode === 'margin' ? Number(margin) : calculatedMargin,
        adFeePercent: adFeePercent * 100,
        label: adType === 'premium' ? 'Premium' : 'Clássico',
        breakEven
      };
    } else {
      // Shopee
      const totalCost = calculateShopeeCost(finalPrice);
      const netValue = finalPrice - totalCost;
      const profit = costPrice !== '' ? netValue - Number(costPrice) : 0;
      const calculatedMargin = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;
      
      const rule = SHOPEE_RULES.find(r => finalPrice >= r.min && finalPrice <= r.max) || SHOPEE_RULES[SHOPEE_RULES.length - 1];
      const breakEven = calculateSalePriceFromMargin(Number(costPrice), 0, marketplace, Number(weight), adType);

      return {
        price: finalPrice,
        adFee: finalPrice * rule.percent,
        shippingCost: rule.fixed,
        totalCost,
        netValue,
        profit,
        margin: priceMode === 'margin' ? Number(margin) : calculatedMargin,
        adFeePercent: rule.percent * 100,
        label: 'Shopee',
        breakEven
      };
    }
  }, [price, weight, adType, marketplace, costPrice, margin, priceMode]);

  const handleAddProduct = () => {
    if (!sku || !name || !currentCalculation) return;

    const newProduct: Product = {
      id: crypto.randomUUID(),
      adId: adId || undefined,
      sku,
      name,
      price: currentCalculation.price,
      costPrice: Number(costPrice) || 0,
      weight: marketplace === 'mercadolivre' ? Number(weight) : 0,
      adType: marketplace === 'shopee' ? 'shopee' : adType,
      marketplace,
      margin: currentCalculation.margin
    };

    setProducts([newProduct, ...products]);
    setSku('');
    setAdId('');
    setName('');
    setPrice('');
    setWeight('');
    setCostPrice('');
    setMargin('');
  };

  const removeProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const updateProductPrice = (id: string, newPrice: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const costs = calculateProductCosts({
          price: newPrice,
          weight: p.weight,
          marketplace: p.marketplace,
          adType: p.adType,
          costPrice: p.costPrice
        });
        // Set originalPrice only if it hasn't been set yet
        const originalPrice = p.originalPrice ?? p.price;
        return { ...p, price: newPrice, margin: costs.margin, originalPrice };
      }
      return p;
    }));
  };

  const confirmPriceUpdate = (id: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const { originalPrice, ...rest } = p;
        return { ...rest, originalPrice: undefined };
      }
      return p;
    }));
  };

  const updateProductAdType = (id: string, newAdType: 'classic' | 'premium') => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const costs = calculateProductCosts({
          price: p.price,
          weight: p.weight,
          marketplace: p.marketplace,
          adType: newAdType,
          costPrice: p.costPrice
        });
        const originalAdType = p.originalAdType ?? p.adType;
        return { ...p, adType: newAdType, margin: costs.margin, originalAdType };
      }
      return p;
    }));
  };

  const confirmAdTypeUpdate = (id: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        const { originalAdType, ...rest } = p;
        return { ...rest, originalAdType: undefined };
      }
      return p;
    }));
  };

  const calculateProductCosts = (product: Partial<Product> & { price: number, weight: number, marketplace: string, adType: string }) => {
    let shipping = 0;
    let adFee = 0;
    let adFeePercent = 0;

    if (product.marketplace === 'mercadolivre') {
      adFeePercent = product.adType === 'premium' ? 0.17 : 0.12;
      adFee = product.price * adFeePercent;
      shipping = calculateShipping(product.price, product.weight);
    } else {
      const rule = SHOPEE_RULES.find(r => product.price >= r.min && product.price <= r.max) || SHOPEE_RULES[SHOPEE_RULES.length - 1];
      adFeePercent = rule.percent;
      adFee = product.price * adFeePercent;
      shipping = rule.fixed;
    }

    const totalCost = adFee + shipping;
    const profit = product.price - totalCost - (product.costPrice || 0);
    const marginVal = product.price > 0 ? (profit / product.price) * 100 : 0;

    return { adFee, shipping, totalCost, profit, margin: marginVal, adFeePercent: adFeePercent * 100 };
  };

  const globalSummary = useMemo(() => {
    let filteredForSummary = summaryFilter === 'all' 
      ? products 
      : products.filter(p => p.marketplace === summaryFilter);

    if (summaryFilter === 'mercadolivre' && adTypeFilter !== 'all') {
      filteredForSummary = filteredForSummary.filter(p => p.adType === adTypeFilter);
    }

    if (filteredForSummary.length === 0) return null;

    return filteredForSummary.reduce((acc, p) => {
      const costs = calculateProductCosts({
        price: p.price,
        weight: p.weight,
        marketplace: p.marketplace,
        adType: p.adType,
        costPrice: p.costPrice
      });

      acc.totalRevenue += p.price;
      acc.totalCostPrice += p.costPrice;
      acc.totalAdFees += costs.adFee;
      acc.totalShipping += costs.shipping;
      acc.totalProfit += costs.profit;
      acc.count += 1;
      return acc;
    }, {
      totalRevenue: 0,
      totalCostPrice: 0,
      totalAdFees: 0,
      totalShipping: 0,
      totalProfit: 0,
      count: 0
    });
  }, [products, summaryFilter, adTypeFilter]);

  const filteredProducts = useMemo(() => {
    let result = products;
    
    if (summaryFilter !== 'all') {
      result = result.filter(p => p.marketplace === summaryFilter);
    }

    if (summaryFilter === 'mercadolivre' && adTypeFilter !== 'all') {
      result = result.filter(p => p.adType === adTypeFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => {
        const sku = (p.sku || '').toString().toLowerCase();
        const name = (p.name || '').toString().toLowerCase();
        const adId = (p.adId || '').toString().toLowerCase();
        return sku.includes(query) || name.includes(query) || adId.includes(query);
      });
    }

    if (showBelowTargetOnly) {
      result = result.filter(p => {
        const costs = calculateProductCosts({
          price: p.price,
          weight: p.weight,
          marketplace: p.marketplace,
          adType: p.adType,
          costPrice: p.costPrice
        });
        return costs.margin < targetCompanyMargin;
      });
    }
    
    return result;
  }, [products, searchQuery, summaryFilter, adTypeFilter, showBelowTargetOnly, targetCompanyMargin]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    const processData = (data: any[]) => {
      const newProducts: Product[] = data
        .filter(row => row && (row.sku || row.name)) // Skip empty rows
        .map((row: any) => {
          const mkt = String(row.marketplace || 'mercadolivre').toLowerCase().trim().replace(/\s/g, '') as 'mercadolivre' | 'shopee';
          const type = String(row.adType || 'classic').toLowerCase().trim() as 'classic' | 'premium' | 'shopee';
          const cost = Number(row.costPrice) || 0;
          const sellPrice = Number(row.price) || 0;
          const w = Number(row.weight) || 0;

          const costs = calculateProductCosts({
            price: sellPrice,
            weight: w,
            marketplace: mkt,
            adType: type,
            costPrice: cost
          });

          return {
            id: crypto.randomUUID(),
            adId: row.adId ? String(row.adId) : undefined,
            sku: String(row.sku || 'N/A'),
            name: String(row.name || 'Produto Sem Nome'),
            price: sellPrice,
            costPrice: cost,
            weight: w,
            adType: mkt === 'shopee' ? 'shopee' : (type === 'premium' ? 'premium' : 'classic'),
            marketplace: mkt === 'shopee' ? 'shopee' : 'mercadolivre',
            margin: costs.margin
          };
        });

      setProducts(prev => [...newProducts, ...prev]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data);
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        processData(jsonData);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const downloadTemplate = (format: 'csv' | 'xlsx') => {
    const data = [
      { adId: "MLB123456789", sku: "PROD-001", name: "Exemplo Produto", costPrice: 50.00, price: 120.00, weight: 0.5, marketplace: "mercadolivre", adType: "premium" },
      { adId: "SHP987654321", sku: "PROD-002", name: "Outro Exemplo", costPrice: 30.00, price: 85.00, weight: 0.2, marketplace: "shopee", adType: "shopee" }
    ];

    if (format === 'csv') {
      const csvContent = "adId,sku,name,costPrice,price,weight,marketplace,adType\n" + 
        data.map(row => `${row.adId},${row.sku},${row.name},${row.costPrice},${row.price},${row.weight},${row.marketplace},${row.adType}`).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "template_marketplace.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
      XLSX.writeFile(workbook, "template_marketplace.xlsx");
    }
  };

  const theme = useMemo(() => {
    if (marketplace === 'mercadolivre') {
      return {
        primary: 'text-[#2D3277]',
        accent: 'bg-[#2D3277]',
        accentHover: 'hover:bg-[#1E2255]',
        border: 'border-[#2D3277]',
        ring: 'focus:ring-[#2D3277]/20',
        focusBorder: 'focus:border-[#2D3277]',
        lightBg: 'bg-blue-50',
        lightText: 'text-blue-700',
        icon: 'text-[#2D3277]',
        button: 'bg-[#2D3277] hover:bg-[#1E2255] text-white',
        preview: 'bg-[#2D3277]',
        badge: 'bg-blue-100 text-blue-700',
        inputIcon: 'text-[#2D3277]/40'
      };
    }
    return {
      primary: 'text-[#EE4D2D]',
      accent: 'bg-[#EE4D2D]',
      accentHover: 'hover:bg-[#D73211]',
      border: 'border-[#EE4D2D]',
      ring: 'focus:ring-[#EE4D2D]/20',
      focusBorder: 'focus:border-[#EE4D2D]',
      lightBg: 'bg-orange-50',
      lightText: 'text-orange-700',
      icon: 'text-[#EE4D2D]',
      button: 'bg-[#EE4D2D] hover:bg-[#D73211] text-white',
      preview: 'bg-[#EE4D2D]',
      badge: 'bg-orange-100 text-orange-700',
      inputIcon: 'text-[#EE4D2D]/40'
    };
  }, [marketplace]);

  return (
    <div className={`min-h-screen font-sans p-4 md:p-8 transition-colors duration-500 ${marketplace === 'mercadolivre' ? 'bg-[#FFF9C4]/30' : 'bg-[#FFF5F2]'}`}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Calculator className={`w-8 h-8 ${theme.icon}`} />
              Calculadora Marketplace
            </h1>
            <p className="text-gray-500 mt-1">Gestão de custos operacionais e margens</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
              <button 
                onClick={() => downloadTemplate('csv')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-[10px] font-bold text-gray-600 hover:text-emerald-600 transition-all shadow-sm"
              >
                <Download className="w-3 h-3" />
                CSV
              </button>
              <button 
                onClick={() => downloadTemplate('xlsx')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg text-[10px] font-bold text-gray-600 hover:text-blue-600 transition-all shadow-sm"
              >
                <FileText className="w-3 h-3" />
                Excel
              </button>
            </div>
            <label className={`flex items-center gap-2 px-4 py-2.5 ${theme.button} rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md active:scale-95`}>
              <Upload className="w-4 h-4" />
              Subir Lista
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv, .xlsx, .xls"
                className="hidden" 
              />
            </label>
            <div className="hidden md:block text-right ml-4">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-400">Versão 1.3.1</p>
            </div>
          </div>
        </header>

        {/* Global Summary */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Resumo Geral
            </h3>
            <div className="flex flex-col items-end gap-2">
              <div className="flex bg-gray-100 p-1 rounded-xl gap-1">
                <button 
                  onClick={() => {
                    setSummaryFilter('all');
                    setAdTypeFilter('all');
                  }}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${summaryFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Todos
                </button>
                <button 
                  onClick={() => setSummaryFilter('mercadolivre')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${summaryFilter === 'mercadolivre' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Mercado Livre
                </button>
                <button 
                  onClick={() => {
                    setSummaryFilter('shopee');
                    setAdTypeFilter('all');
                  }}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${summaryFilter === 'shopee' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Shopee
                </button>
              </div>

              {summaryFilter === 'mercadolivre' && (
                <motion.div 
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex bg-blue-50/50 p-1 rounded-xl gap-1 border border-blue-100"
                >
                  <button 
                    onClick={() => setAdTypeFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${adTypeFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-400 hover:text-blue-600'}`}
                  >
                    Todos ML
                  </button>
                  <button 
                    onClick={() => setAdTypeFilter('classic')}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${adTypeFilter === 'classic' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-400 hover:text-blue-600'}`}
                  >
                    Clássico
                  </button>
                  <button 
                    onClick={() => setAdTypeFilter('premium')}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${adTypeFilter === 'premium' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-400 hover:text-blue-600'}`}
                  >
                    Premium
                  </button>
                </motion.div>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {globalSummary ? (
              <motion.div 
                key={summaryFilter}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 md:grid-cols-5 gap-4"
              >
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Faturamento Total</p>
                  <p className="text-xl font-bold font-mono">R$ {formatMoney(globalSummary.totalRevenue)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Custo Mercadoria</p>
                  <p className="text-xl font-bold font-mono text-orange-600">R$ {formatMoney(globalSummary.totalCostPrice)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Comissões</p>
                  <p className="text-xl font-bold font-mono text-red-500">R$ {formatMoney(globalSummary.totalAdFees)}</p>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Fretes</p>
                  <p className="text-xl font-bold font-mono text-red-500">R$ {formatMoney(globalSummary.totalShipping)}</p>
                </div>
                <div className="bg-emerald-600 p-4 rounded-2xl shadow-lg text-white col-span-2 md:col-span-1 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-white/70 uppercase mb-1">Lucro Líquido</p>
                    <p className="text-xl font-bold font-mono">R$ {formatMoney(globalSummary.totalProfit)}</p>
                  </div>
                  <div className="mt-2">
                    <div className="flex justify-between text-[8px] font-bold uppercase mb-1">
                      <span>Margem Média</span>
                      <span>{((globalSummary.totalProfit / globalSummary.totalRevenue) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white" 
                        style={{ width: `${Math.max(0, Math.min(100, (globalSummary.totalProfit / globalSummary.totalRevenue) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center">
                <p className="text-gray-400 text-xs font-medium">Nenhum produto encontrado para este marketplace na lista.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Target Margin Configuration & Performance Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-50 p-2 rounded-lg">
                <Percent className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Meta de Margem</h4>
                <p className="text-[10px] text-gray-400 uppercase font-bold">Configuração da Empresa</p>
              </div>
            </div>
            <div className="relative">
              <input 
                type="number" 
                value={targetCompanyMargin}
                onChange={(e) => setTargetCompanyMargin(Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono font-bold text-lg"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-3 italic">Esta meta será usada para comparar o desempenho real da sua carteira de produtos.</p>
          </div>

          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                Dashboard de Performance de Margem
              </h4>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                globalSummary && (globalSummary.totalProfit / globalSummary.totalRevenue * 100) >= targetCompanyMargin 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {globalSummary && (globalSummary.totalProfit / globalSummary.totalRevenue * 100) >= targetCompanyMargin ? 'META ATINGIDA' : 'ABAIXO DA META'}
              </span>
            </div>

            {globalSummary ? (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Margem Real vs Meta</p>
                      <p className="text-2xl font-bold font-mono text-gray-900">
                        {((globalSummary.totalProfit / globalSummary.totalRevenue) * 100).toFixed(1)}% 
                        <span className="text-sm font-normal text-gray-400 ml-2">/ {targetCompanyMargin}%</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Diferença</p>
                      <p className={`text-sm font-bold font-mono ${
                        (globalSummary.totalProfit / globalSummary.totalRevenue * 100) - targetCompanyMargin >= 0 
                          ? 'text-emerald-600' 
                          : 'text-red-600'
                      }`}>
                        {((globalSummary.totalProfit / globalSummary.totalRevenue * 100) - targetCompanyMargin).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute top-0 bottom-0 bg-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, (globalSummary.totalProfit / globalSummary.totalRevenue * 100 / targetCompanyMargin) * 100))}%` }}
                    />
                    <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-gray-900/20 z-10"
                      style={{ left: '100%' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Markup Médio (Sobre Custo)</p>
                    <p className="text-sm font-bold font-mono text-gray-700">
                      {((globalSummary.totalRevenue / globalSummary.totalCostPrice - 1) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Eficiência de Operação</p>
                    <p className="text-sm font-bold font-mono text-gray-700">
                      {((globalSummary.totalProfit / (globalSummary.totalAdFees + globalSummary.totalShipping)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-400 text-xs italic">
                Adicione produtos para visualizar a performance.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Input Form */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Plus className={`w-5 h-5 ${theme.icon}`} />
                Novo Produto
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Marketplace</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setMarketplace('mercadolivre')}
                      className={`py-2.5 px-4 rounded-xl border text-sm font-bold transition-all ${marketplace === 'mercadolivre' ? 'bg-[#FFE600] border-[#FFE600] text-[#2D3277] shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                    >
                      Mercado Livre
                    </button>
                    <button 
                      onClick={() => setMarketplace('shopee')}
                      className={`py-2.5 px-4 rounded-xl border text-sm font-bold transition-all ${marketplace === 'shopee' ? 'bg-[#EE4D2D] border-[#EE4D2D] text-white shadow-md' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'}`}
                    >
                      Shopee
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">ID do Anúncio</label>
                    <div className="relative">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.inputIcon}`} />
                      <input 
                        type="text" 
                        value={adId}
                        onChange={(e) => setAdId(e.target.value)}
                        placeholder="Ex: MLB123456789"
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 ${theme.ring} ${theme.focusBorder} transition-all text-sm`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">SKU</label>
                    <div className="relative">
                      <Tag className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.inputIcon}`} />
                      <input 
                        type="text" 
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="Ex: PROD-001"
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 ${theme.ring} ${theme.focusBorder} transition-all text-sm`}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Custo do Produto (R$)</label>
                    <div className="relative">
                      <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.inputIcon}`} />
                      <input 
                        type="number" 
                        value={costPrice}
                        onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0,00"
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 ${theme.ring} ${theme.focusBorder} transition-all text-sm`}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Nome do Produto</label>
                  <div className="relative">
                    <Package className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.inputIcon}`} />
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nome do produto"
                      className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 ${theme.ring} ${theme.focusBorder} transition-all`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Modo de Precificação</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setPriceMode('direct')}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${priceMode === 'direct' ? `${theme.lightBg} ${theme.border} ${theme.lightText}` : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                      Preço Direto
                    </button>
                    <button 
                      onClick={() => setPriceMode('margin')}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${priceMode === 'margin' ? `${theme.lightBg} ${theme.border} ${theme.lightText}` : 'bg-white border-gray-200 text-gray-600'}`}
                    >
                      Margem Desejada
                    </button>
                  </div>
                </div>

                <div className={`grid gap-4 ${marketplace === 'mercadolivre' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                      {priceMode === 'direct' ? 'Preço de Venda (R$)' : 'Margem de Lucro (%)'}
                    </label>
                    <div className="relative">
                      {priceMode === 'direct' ? <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.inputIcon}`} /> : <Percent className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.inputIcon}`} />}
                      <input 
                        type="number" 
                        value={priceMode === 'direct' ? price : margin}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : Number(e.target.value);
                          if (priceMode === 'direct') setPrice(val);
                          else setMargin(val);
                        }}
                        placeholder={priceMode === 'direct' ? "0,00" : "Ex: 20"}
                        className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 ${theme.ring} ${theme.focusBorder} transition-all`}
                      />
                    </div>
                  </div>
                  {marketplace === 'mercadolivre' && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Peso (kg)</label>
                      <div className="relative">
                        <Weight className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.inputIcon}`} />
                        <input 
                          type="number" 
                          step="0.01"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
                          placeholder="0.00"
                          className={`w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 ${theme.ring} ${theme.focusBorder} transition-all`}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {marketplace === 'mercadolivre' && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Tipo de Anúncio</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => setAdType('classic')}
                        className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${adType === 'classic' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        Clássico (12%)
                      </button>
                      <button 
                        onClick={() => setAdType('premium')}
                        className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${adType === 'premium' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        Premium (17%)
                      </button>
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleAddProduct}
                  disabled={!sku || !name || !currentCalculation}
                  className={`w-full py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-lg active:scale-[0.98] ${theme.button}`}
                >
                  Adicionar à Lista
                </button>
              </div>
            </section>

            {/* Real-time Preview */}
            <AnimatePresence mode="wait">
              {currentCalculation && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`rounded-2xl p-6 shadow-xl text-white ${theme.preview}`}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-mono uppercase tracking-widest text-white/70">Resumo {marketplace === 'mercadolivre' ? 'ML' : 'Shopee'}</h3>
                    {priceMode === 'margin' && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded">Preço Sugerido</span>}
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-white/10 border-b">
                      <span className="text-white/60 text-sm">Preço de Venda</span>
                      <span className="font-mono font-bold">R$ {formatMoney(currentCalculation.price)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-white/10 border-b">
                      <span className="text-white/60 text-sm">Comissão ({currentCalculation.adFeePercent.toFixed(0)}%)</span>
                      <span className="font-mono">R$ {formatMoney(currentCalculation.adFee)}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-white/10 border-b">
                      <span className="text-white/60 text-sm">{marketplace === 'mercadolivre' ? 'Frete ML' : 'Taxa Fixa'}</span>
                      <span className="font-mono">R$ {formatMoney(currentCalculation.shippingCost)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="bg-black/20 rounded-xl p-3">
                        <p className="text-[10px] text-white/60 uppercase mb-1">Lucro Bruto</p>
                        <p className="text-lg font-bold font-mono">R$ {formatMoney(currentCalculation.profit)}</p>
                      </div>
                      <div className="bg-black/20 rounded-xl p-3">
                        <p className="text-[10px] text-white/60 uppercase mb-1">Margem</p>
                        <p className="text-lg font-bold font-mono">{currentCalculation.margin.toFixed(1)}%</p>
                      </div>
                    </div>
                    {currentCalculation.breakEven > 0 && (
                      <div className="bg-white/10 rounded-xl p-3 mt-2 flex justify-between items-center">
                        <span className="text-[10px] text-white/60 uppercase">Ponto de Equilíbrio (0% Margem)</span>
                        <span className="text-xs font-mono font-bold">R$ {currentCalculation.breakEven.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Product List */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[500px]">
              <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="w-5 h-5 text-gray-400" />
                    Lista de Produtos
                  </h2>
                  <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2.5 py-1 rounded-full">
                    {filteredProducts.length} {filteredProducts.length === 1 ? 'ITEM' : 'ITENS'}
                  </span>
                  {products.length > 0 && (
                    <button 
                      onClick={() => setShowClearModal(true)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1 hover:bg-red-50 rounded-lg"
                      title="Limpar Lista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <button 
                    onClick={() => setShowBelowTargetOnly(!showBelowTargetOnly)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold transition-all border ${
                      showBelowTargetOnly 
                        ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' 
                        : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <Percent className="w-3 h-3" />
                    Abaixo da Meta
                  </button>
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filtrar por SKU, Nome ou ID..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-xs"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-gray-400 px-6 text-center">
                  <div className="bg-gray-50 p-4 rounded-full mb-4">
                    {searchQuery ? <Search className="w-12 h-12 opacity-20" /> : <Calculator className="w-12 h-12 opacity-20" />}
                  </div>
                  <p className="text-sm font-medium">
                    {searchQuery ? 'Nenhum produto encontrado para sua busca.' : 'Nenhum produto calculado ainda.'}
                  </p>
                  <p className="text-xs mt-1">
                    {searchQuery ? 'Tente outro SKU ou nome.' : 'Configure o custo e a margem ou suba uma lista CSV.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[650px] overflow-y-auto custom-scrollbar">
                  <AnimatePresence initial={false}>
                    {filteredProducts.map((product) => {
                      const costs = calculateProductCosts({
                        price: product.price,
                        weight: product.weight,
                        marketplace: product.marketplace,
                        adType: product.adType,
                        costPrice: product.costPrice
                      });
                      const totalCost = costs.totalCost;
                      const profit = costs.profit;

                      return (
                        <motion.div 
                          key={product.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="p-6 hover:bg-gray-50 transition-colors group"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {product.adId && (
                                  <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {product.adId}
                                  </span>
                                )}
                                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase ${
                                  product.marketplace === 'mercadolivre' ? 'text-blue-700 bg-blue-50' : 'text-orange-700 bg-orange-50'
                                }`}>
                                  {product.sku}
                                </span>
                                {product.marketplace === 'mercadolivre' ? (
                                  <div className="flex items-center gap-1.5">
                                    <button 
                                      onClick={() => updateProductAdType(product.id, product.adType === 'classic' ? 'premium' : 'classic')}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shadow-sm transition-all flex items-center gap-1 ${
                                        product.originalAdType !== undefined && product.adType !== product.originalAdType
                                          ? 'bg-orange-500 text-white ring-2 ring-orange-500/20' 
                                          : 'bg-[#FFE600] text-[#2D3277] hover:bg-[#F0D800]'
                                      }`}
                                      title="Clique para alternar entre Clássico e Premium"
                                    >
                                      ML {product.adType}
                                      {product.originalAdType !== undefined && product.adType !== product.originalAdType && (
                                        <Info className="w-2.5 h-2.5" />
                                      )}
                                    </button>
                                    {product.originalAdType !== undefined && product.adType !== product.originalAdType && (
                                      <div className="flex items-center gap-1">
                                        <button 
                                          onClick={() => confirmAdTypeUpdate(product.id)}
                                          className="p-1 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors"
                                          title="Confirmar alteração de tipo de anúncio"
                                        >
                                          <Plus className="w-3 h-3 rotate-45" />
                                        </button>
                                        <span className="text-[8px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full border border-orange-200 whitespace-nowrap">
                                          TIPO ALTERADO
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shadow-sm ${
                                    product.marketplace === 'mercadolivre' 
                                      ? 'bg-[#FFE600] text-[#2D3277]' 
                                      : 'bg-[#EE4D2D] text-white'
                                  }`}>
                                    {product.marketplace === 'mercadolivre' ? `ML ${product.adType}` : 'Shopee'}
                                  </span>
                                )}
                              </div>
                              <h3 className="font-semibold text-gray-900">{product.name}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => setExpandedProductId(expandedProductId === product.id ? null : product.id)}
                                className={`p-2 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold uppercase ${
                                  expandedProductId === product.id 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                <ReceiptText className="w-3.5 h-3.5" />
                                {expandedProductId === product.id ? 'Ocultar' : 'Detalhes'}
                                {expandedProductId === product.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                              <button 
                                onClick={() => removeProduct(product.id)}
                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                              <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Custo</p>
                              <p className="font-mono font-bold text-xs">R$ {formatMoney(product.costPrice)}</p>
                            </div>
                            <div className={`p-2 rounded-xl border transition-all duration-300 ${
                              product.originalPrice !== undefined && product.price !== product.originalPrice
                                ? 'bg-orange-50 border-orange-200 ring-2 ring-orange-500/20' 
                                : 'bg-gray-50/50 border-gray-100'
                            } group/price relative`}>
                              <div className="flex justify-between items-start mb-0.5">
                                <p className={`text-[9px] font-bold uppercase ${
                                  product.originalPrice !== undefined && product.price !== product.originalPrice
                                    ? 'text-orange-600' 
                                    : 'text-gray-400'
                                }`}>Venda</p>
                                {product.originalPrice !== undefined && product.price !== product.originalPrice && (
                                  <button 
                                    onClick={() => confirmPriceUpdate(product.id)}
                                    className="p-0.5 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors shadow-sm"
                                    title="Confirmar atualização no marketplace"
                                  >
                                    <Plus className="w-2 h-2 rotate-45" />
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`font-mono font-bold text-[10px] ${
                                  product.originalPrice !== undefined && product.price !== product.originalPrice
                                    ? 'text-orange-500' 
                                    : 'text-gray-400'
                                }`}>R$</span>
                                <input 
                                  type="text"
                                  inputMode="decimal"
                                  value={product.price.toFixed(2).replace('.', ',')}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(',', '.');
                                    if (!isNaN(Number(val)) || val === '' || val === '.') {
                                      updateProductPrice(product.id, Number(val));
                                    }
                                  }}
                                  className={`w-full bg-transparent font-mono font-bold text-xs focus:outline-none rounded px-1 -ml-1 border-b border-dashed transition-all ${
                                    product.originalPrice !== undefined && product.price !== product.originalPrice
                                      ? 'text-orange-700 border-orange-300 focus:border-orange-500' 
                                      : 'border-gray-200 hover:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                                  }`}
                                  title="Clique para editar o preço de venda"
                                />
                              </div>
                              {product.originalPrice !== undefined && product.price !== product.originalPrice && (
                                <div className="absolute -bottom-4 left-0 right-0 text-center">
                                  <span className="text-[8px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full border border-orange-200 whitespace-nowrap">
                                    Pendente no MKT
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                              <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Taxas</p>
                              <p className="font-mono font-bold text-xs text-red-500">R$ {formatMoney(totalCost)}</p>
                            </div>
                            <div className={`${profit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} p-2 rounded-xl border`}>
                              <p className={`text-[9px] font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'} uppercase mb-1`}>Lucro</p>
                              <p className={`font-mono font-bold text-xs ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>R$ {formatMoney(profit)}</p>
                            </div>
                            <div className={`${costs.margin >= targetCompanyMargin ? 'bg-emerald-50 border-emerald-100' : costs.margin > 0 ? 'bg-orange-50 border-orange-200' : 'bg-red-50 border-red-100'} p-2 rounded-xl border transition-colors duration-300`}>
                              <p className={`text-[9px] font-bold ${costs.margin >= targetCompanyMargin ? 'text-emerald-600' : costs.margin > 0 ? 'text-orange-600' : 'text-red-600'} uppercase mb-0.5`}>Margem</p>
                              <p className={`font-mono font-bold text-xs ${costs.margin >= targetCompanyMargin ? 'text-emerald-700' : costs.margin > 0 ? 'text-orange-700' : 'text-red-700'}`}>{costs.margin.toFixed(1)}%</p>
                            </div>
                          </div>

                          <AnimatePresence>
                            {expandedProductId === product.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                  <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-1.5">
                                    <BarChart3 className="w-3 h-3" />
                                    Detalhamento de Custos Operacionais
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Preço de Venda</span>
                                        <span className="font-mono font-bold">R$ {formatMoney(product.price)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Custo da Mercadoria</span>
                                        <span className="font-mono text-orange-600">- R$ {formatMoney(product.costPrice)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Comissão Marketplace ({costs.adFeePercent.toFixed(1)}%)</span>
                                        <span className="font-mono text-red-500">- R$ {formatMoney(costs.adFee)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-500">Frete de Envio</span>
                                        <span className="font-mono text-red-500">- R$ {formatMoney(costs.shipping)}</span>
                                      </div>
                                      <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-sm font-bold">
                                        <span className="text-gray-900">Resultado Líquido</span>
                                        <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                          R$ {formatMoney(profit)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-center">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Eficiência da Venda</span>
                                        <span className={`text-xs font-bold ${costs.margin >= targetCompanyMargin ? 'text-emerald-600' : 'text-orange-600'}`}>
                                          {costs.margin >= targetCompanyMargin ? 'Excelente' : 'Atenção'}
                                        </span>
                                      </div>
                                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                                        <div 
                                          className={`h-full transition-all duration-500 ${
                                            costs.margin >= targetCompanyMargin ? 'bg-emerald-500' : costs.margin > 0 ? 'bg-orange-500' : 'bg-red-500'
                                          }`}
                                          style={{ width: `${Math.max(0, Math.min(100, costs.margin))}%` }}
                                        />
                                      </div>
                                      <p className="text-[10px] text-gray-500 leading-relaxed">
                                        {costs.margin >= targetCompanyMargin 
                                          ? `Este produto possui uma margem saudável acima de ${targetCompanyMargin}%, cobrindo bem os custos fixos.` 
                                          : costs.margin > 0 
                                          ? 'A margem está apertada. Considere revisar o preço de venda ou negociar com o fornecedor.' 
                                          : 'Este produto está gerando prejuízo nesta configuração de venda.'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400">
          <div className="flex items-center gap-2 text-xs">
            <Info className="w-4 h-4" />
            <span>Valores baseados nas tabelas de frete e comissões vigentes (ML e Shopee).</span>
          </div>
          <p className="text-xs">© 2026 Sistema de Gestão Marketplace</p>
        </footer>
      </div>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showClearModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Limpar Lista?</h3>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                Esta ação irá remover permanentemente todos os produtos da sua lista. Você não poderá desfazer isso.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    setProducts([]);
                    setShowClearModal(false);
                  }}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 active:scale-95"
                >
                  Sim, Limpar Tudo
                </button>
                <button 
                  onClick={() => setShowClearModal(false)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold transition-all active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
