/**
 * 💰 CÁLCULOS FINANCEIROS CENTRALIZADOS
 * 
 * Este arquivo contém TODAS as funções de cálculo financeiro do sistema.
 * USO OBRIGATÓRIO em todos os dashboards e relatórios.
 * 
 * ⚠️ NÃO duplicar estas funções em outros arquivos!
 * ⚠️ NÃO fazer cálculos manuais nos componentes!
 */

import { Delivery } from './db';

// Taxa administrativa padrão
const ADMIN_FEE_PER_DELIVERY = 1.00;

/**
 * Obtém o valor base da corrida (sem adicional)
 */
export const getDeliveryValue = (d: Delivery): number => {
  return Number(d.value || 0);
};

/**
 * Obtém o valor adicional da corrida
 */
export const getAdditionalValue = (d: Delivery): number => {
  return Number(d.additionalValue || 0);
};

/**
 * Verifica se a corrida é isenta de taxa administrativa
 * Isentas: Corridas de mesmo endereço OU valor <= R$ 4,00
 */
export const isExemptFromAdminFee = (d: Delivery): boolean => {
  const val = getDeliveryValue(d);
  return d.deliveryType === 'same_address' || val <= 4.00;
};

/**
 * Calcula a taxa administrativa da corrida
 * Retorna R$ 0,00 se isenta, R$ 1,00 caso contrário
 */
export const getAdminFee = (d: Delivery): number => {
  return isExemptFromAdminFee(d) ? 0 : ADMIN_FEE_PER_DELIVERY;
};

/**
 * Calcula o valor bruto total (corrida + adicional)
 * Este é o valor que o estabelecimento paga
 */
export const getGrossTotal = (d: Delivery): number => {
  return getDeliveryValue(d) + getAdditionalValue(d);
};

/**
 * Calcula o valor líquido que o motoboy recebe
 * Fórmula: (Valor da corrida - Taxa) + Adicional
 * 
 * IMPORTANTE: Adicional SEMPRE é 100% do motoboy (sem taxa)
 */
export const getRiderNet = (d: Delivery): number => {
  const deliveryValue = getDeliveryValue(d);
  const additional = getAdditionalValue(d);
  const fee = getAdminFee(d);
  
  // (Corrida - Taxa) + Adicional
  const netFromDelivery = Math.max(0, deliveryValue - fee);
  return netFromDelivery + additional;
};

/**
 * Calcula o total de taxas administrativas de múltiplas corridas
 */
export const getTotalAdminFees = (deliveries: Delivery[]): number => {
  return deliveries.reduce((sum, d) => sum + getAdminFee(d), 0);
};

/**
 * Calcula o total bruto de múltiplas corridas
 */
export const getTotalGross = (deliveries: Delivery[]): number => {
  return deliveries.reduce((sum, d) => sum + getGrossTotal(d), 0);
};

/**
 * Calcula o total líquido do motoboy de múltiplas corridas
 */
export const getTotalRiderNet = (deliveries: Delivery[]): number => {
  return deliveries.reduce((sum, d) => sum + getRiderNet(d), 0);
};

/**
 * Calcula o total de adicionais de múltiplas corridas
 */
export const getTotalAdditionals = (deliveries: Delivery[]): number => {
  return deliveries.reduce((sum, d) => sum + getAdditionalValue(d), 0);
};

/**
 * Calcula o total de corridas (valor base) sem adicionais
 */
export const getTotalDeliveryValues = (deliveries: Delivery[]): number => {
  return deliveries.reduce((sum, d) => sum + getDeliveryValue(d), 0);
};

/**
 * Conta corridas de mesmo endereço (isentas)
 */
export const countExemptDeliveries = (deliveries: Delivery[]): number => {
  return deliveries.filter(d => isExemptFromAdminFee(d)).length;
};

/**
 * Conta corridas padrão (com taxa)
 */
export const countStandardDeliveries = (deliveries: Delivery[]): number => {
  return deliveries.filter(d => !isExemptFromAdminFee(d)).length;
};

/**
 * Calcula estatísticas completas de um conjunto de corridas
 */
export interface DeliveryStats {
  count: number;
  exemptCount: number;
  standardCount: number;
  totalDeliveryValues: number;
  totalAdditionals: number;
  totalGross: number;
  totalAdminFees: number;
  totalRiderNet: number;
}

export const calculateDeliveryStats = (deliveries: Delivery[]): DeliveryStats => {
  return {
    count: deliveries.length,
    exemptCount: countExemptDeliveries(deliveries),
    standardCount: countStandardDeliveries(deliveries),
    totalDeliveryValues: getTotalDeliveryValues(deliveries),
    totalAdditionals: getTotalAdditionals(deliveries),
    totalGross: getTotalGross(deliveries),
    totalAdminFees: getTotalAdminFees(deliveries),
    totalRiderNet: getTotalRiderNet(deliveries)
  };
};

// ============================================================
// COMPATIBILIDADE COM CÓDIGO ANTIGO
// ============================================================
// Mantém nomes antigos para não quebrar código existente
// ⚠️ DEPRECATED: Use as funções acima diretamente
// ============================================================

/**
 * @deprecated Use getAdminFee() em vez disso
 */
export const getAdminFeeForDelivery = getAdminFee;

/**
 * @deprecated Use getRiderNet() em vez disso
 */
export const getRiderNetForDelivery = getRiderNet;
