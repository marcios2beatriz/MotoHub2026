"use client";

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Delivery, User, Establishment } from './db';
import { getAdminFeeForDelivery, getRiderNetForDelivery } from '../pages/AdminDashboard';

interface GeneratePdfGeneralOptions {
  riders: User[];
  deliveries: Delivery[];
  establishments: Establishment[];
  periodLabel: string;
  startDate?: string;
  endDate?: string;
  onlyWithDeliveries?: boolean;
  includeOrderNumbers?: boolean;
}

interface GeneratePdfIndividualOptions {
  rider: User;
  deliveries: Delivery[];
  establishments: Establishment[];
  periodLabel: string;
  startDate?: string;
  endDate?: string;
}

export const generateGeneralRidersEarningsPdf = ({
  riders,
  deliveries,
  establishments,
  periodLabel,
  onlyWithDeliveries = true,
  includeOrderNumbers = true
}: GeneratePdfGeneralOptions) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const nowStr = new Date().toLocaleString('pt-BR');
  const activeDeliveries = deliveries.filter(d => d.status === 'active');

  // Filtra motoboys conforme opção selecionada
  const targetRiders = riders.filter(r => {
    if (!onlyWithDeliveries) return true;
    return activeDeliveries.some(d => d.riderId === r.id);
  });

  // Totais Gerais Consolidados
  const relevantDeliveries = activeDeliveries.filter(d => targetRiders.some(r => r.id === d.riderId));
  const totalGross = relevantDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalAdminCut = relevantDeliveries.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
  const totalRidersNet = Math.max(0, totalGross - totalAdminCut);
  const totalAdditionals = relevantDeliveries.reduce((sum, d) => sum + Number(d.additionalValue || 0), 0);
  
  const totalSameAddressDeliveries = relevantDeliveries.filter(d => d.deliveryType === 'same_address' || Number(d.value) <= 4.00);
  const totalSameAddressCount = totalSameAddressDeliveries.length;
  const totalSameAddressValue = totalSameAddressDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);

  const totalStandardDeliveries = relevantDeliveries.filter(d => d.deliveryType !== 'same_address' && Number(d.value) > 4.00);
  const totalStandardCount = totalStandardDeliveries.length;
  const totalStandardValue = totalStandardDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);

  // 1. Cabeçalho Superior
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 27, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('MOTOHUB DELIVERY — FECHAMENTO GERAL DE REPASSES', 14, 11);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Período de Apuração: ${periodLabel}  |  Gerado em: ${nowStr}  |  Entregadores Listados: ${targetRiders.length}`, 14, 18);
  doc.text('Regra: Corridas Padrão (R$ 8) possuem Taxa Adm de R$ 1,00 | Corridas no Mesmo Endereço (R$ 4) são 100% Isentas.', 14, 23);

  // 2. Bloco Resumo Superior (Destaque para Valor Bruto vs Valor Líquido)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 31, 269, 21, 2.5, 2.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 31, 269, 21, 2.5, 2.5, 'S');

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL CORRIDAS', 18, 37);
  doc.text('PADRÃO (R$ 8,00)', 52, 37);
  doc.text('MESMO END. (R$ 4,00)', 92, 37);
  doc.text('+ ADICIONAIS', 136, 37);
  doc.text('VALOR BRUTO TOTAL', 174, 37);
  doc.text('TAXA ADM (- R$ 1)', 214, 37);
  doc.text('VALOR LÍQUIDO MOTOBOYS', 248, 37);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${relevantDeliveries.length}`, 18, 45);

  doc.setTextColor(30, 41, 59);
  doc.text(`${totalStandardCount} (R$ ${totalStandardValue.toFixed(2)})`, 52, 45);

  doc.setTextColor(126, 34, 206);
  doc.text(`${totalSameAddressCount} (R$ ${totalSameAddressValue.toFixed(2)})`, 92, 45);

  doc.setTextColor(180, 83, 9);
  doc.text(`R$ ${totalAdditionals.toFixed(2)}`, 136, 45);

  // Destaque do Bruto
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text(`R$ ${totalGross.toFixed(2)}`, 174, 45);

  // Destaque da Taxa
  doc.setTextColor(185, 28, 28); // red-700
  doc.text(`- R$ ${totalAdminCut.toFixed(2)}`, 214, 45);

  // Destaque do Líquido
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`R$ ${totalRidersNet.toFixed(2)}`, 248, 45);

  // 3. Tabela Consolidada com Colunas de Bruto e Líquido Bem Evidenciadas
  const headers = [
    '#',
    'Entregador (Motoboy)',
    'Telefone / CPF',
    'Qtd',
    ...(includeOrderNumbers ? ['Nº Pedidos'] : []),
    'Padrão (R$ 8)',
    'Mesmo End. (R$ 4)',
    '+ Adicionais',
    'VALOR BRUTO',
    'TAXA ADM',
    'LÍQUIDO MOTOBOY',
    'Status'
  ];

  const tableData = targetRiders.map((rider, idx) => {
    const riderDels = activeDeliveries.filter(d => d.riderId === rider.id);
    const count = riderDels.length;

    const orderNumbersList = riderDels
      .map(d => d.orderNumber ? `#${d.orderNumber}` : null)
      .filter(Boolean);
    const orderNumbersFormatted = orderNumbersList.length > 0 
      ? orderNumbersList.join(', ') 
      : '-';

    const stdDels = riderDels.filter(d => d.deliveryType !== 'same_address' && Number(d.value) > 4.00);
    const stdCount = stdDels.length;
    const stdTotal = stdDels.reduce((sum, d) => sum + Number(d.value || 0), 0);

    const sameAddrDels = riderDels.filter(d => d.deliveryType === 'same_address' || Number(d.value) <= 4.00);
    const sameAddrCount = sameAddrDels.length;
    const sameAddrTotal = sameAddrDels.reduce((sum, d) => sum + Number(d.value || 0), 0);

    const addsTotal = riderDels.reduce((sum, d) => sum + Number(d.additionalValue || 0), 0);
    const grossTotal = riderDels.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const admCutTotal = riderDels.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
    const netTotal = Math.max(0, grossTotal - admCutTotal);
    const isPaid = count > 0 && riderDels.every(d => d.paid);

    const row = [
      `${idx + 1}`,
      rider.name,
      rider.phone || rider.cpf || '-',
      `${count}`,
      ...(includeOrderNumbers ? [orderNumbersFormatted] : []),
      `${stdCount} (R$ ${stdTotal.toFixed(2)})`,
      `${sameAddrCount} (R$ ${sameAddrTotal.toFixed(2)})`,
      `R$ ${addsTotal.toFixed(2)}`,
      `R$ ${grossTotal.toFixed(2)}`,
      `R$ ${admCutTotal.toFixed(2)}`,
      `R$ ${netTotal.toFixed(2)}`,
      count === 0 ? 'SEM CORRIDAS' : isPaid ? 'PAGO' : 'A REPASSAR'
    ];

    return row;
  });

  const columnStylesConfig: any = includeOrderNumbers ? {
    0: { halign: 'center', cellWidth: 7 },
    1: { fontStyle: 'bold', halign: 'left', cellWidth: 35 },
    2: { halign: 'center', cellWidth: 23 },
    3: { halign: 'center', fontStyle: 'bold', cellWidth: 10 },
    4: { halign: 'left', cellWidth: 42, fontStyle: 'normal', textColor: [71, 85, 105] }, // Nº Pedidos
    5: { halign: 'center', cellWidth: 26 },
    6: { halign: 'center', textColor: [126, 34, 206], cellWidth: 26 },
    7: { halign: 'right', textColor: [180, 83, 9], cellWidth: 18 },
    8: { halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138], cellWidth: 23 }, // Bruto
    9: { halign: 'right', textColor: [185, 28, 28], cellWidth: 18 }, // Taxa
    10: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 24 }, // Líquido
    11: { halign: 'center', fontStyle: 'bold', cellWidth: 17 }
  } : {
    0: { halign: 'center', cellWidth: 8 },
    1: { fontStyle: 'bold', halign: 'left', cellWidth: 45 },
    2: { halign: 'center', cellWidth: 28 },
    3: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
    4: { halign: 'center', cellWidth: 32 },
    5: { halign: 'center', textColor: [126, 34, 206], cellWidth: 32 },
    6: { halign: 'right', textColor: [180, 83, 9], cellWidth: 22 },
    7: { halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138], cellWidth: 25 }, // Bruto
    8: { halign: 'right', textColor: [185, 28, 28], cellWidth: 20 }, // Taxa
    9: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 26 }, // Líquido
    10: { halign: 'center', fontStyle: 'bold', cellWidth: 19 }
  };

  autoTable(doc, {
    startY: 55,
    head: [headers],
    body: tableData as any,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229], // indigo-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    columnStyles: columnStylesConfig,
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Linha final com totais consolidados
  const finalY = (doc as any).lastAutoTable.finalY + 7;
  if (finalY < 185) {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, finalY, 269, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL GERAL ACUMULADO (${relevantDeliveries.length} corridas):`, 18, finalY + 6.5);
    doc.setTextColor(30, 58, 138);
    doc.text(`VALOR BRUTO: R$ ${totalGross.toFixed(2)}`, 132, finalY + 6.5);
    doc.setTextColor(185, 28, 28);
    doc.text(`TAXA ADM: - R$ ${totalAdminCut.toFixed(2)}`, 185, finalY + 6.5);
    doc.setTextColor(5, 150, 105);
    doc.text(`VALOR LÍQUIDO (A PAGAR): R$ ${totalRidersNet.toFixed(2)}`, 230, finalY + 6.5);
  }

  // Rodapé com numeração de página
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MotoHub Delivery — Página ${i} de ${pageCount} | Documento Oficial de Fechamento Financeiro`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  const filename = `relatorio_fechamento_motoboys_${periodLabel.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
};

export const generateIndividualRiderEarningsPdf = ({
  rider,
  deliveries,
  establishments,
  periodLabel
}: GeneratePdfIndividualOptions) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const nowStr = new Date().toLocaleString('pt-BR');
  const activeDeliveries = deliveries
    .filter(d => d.status === 'active' && d.riderId === rider.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  // Totais do Motoboy
  const totalGross = activeDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalAdminCut = activeDeliveries.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
  const totalRiderNet = Math.max(0, totalGross - totalAdminCut);
  const totalAdditionals = activeDeliveries.reduce((sum, d) => sum + Number(d.additionalValue || 0), 0);
  
  const sameAddressDeliveries = activeDeliveries.filter(d => d.deliveryType === 'same_address' || Number(d.value) <= 4.00);
  const sameAddressCount = sameAddressDeliveries.length;
  const sameAddressTotal = sameAddressDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);

  const standardDeliveries = activeDeliveries.filter(d => d.deliveryType !== 'same_address' && Number(d.value) > 4.00);
  const standardCount = standardDeliveries.length;
  const standardTotal = standardDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);

  // Cabeçalho
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MOTOHUB DELIVERY', 14, 13);

  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225);
  doc.text(`EXTRATO INDIVIDUAL DE REPASSE: ${rider.name.toUpperCase()}`, 14, 21);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`CPF: ${rider.cpf || 'Não informado'} | Telefone: ${rider.phone || 'Não informado'} | Período: ${periodLabel}`, 14, 28);
  doc.text(`Gerado em: ${nowStr}`, 14, 33);

  // Caixa de Resumo de Métricas (Bruto, Taxa Adm e Líquido)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 40, 182, 30, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 40, 182, 30, 3, 3, 'S');

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL CORRIDAS', 18, 46);
  doc.text('PADRÃO (R$ 8,00)', 52, 46);
  doc.text('MESMO END. (R$ 4,00)', 88, 46);
  doc.text('+ ADICIONAIS', 126, 46);
  doc.text('TAXA ADM (- R$ 1)', 158, 46);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${activeDeliveries.length}`, 18, 54);

  doc.setTextColor(30, 41, 59);
  doc.text(`${standardCount} (R$ ${standardTotal.toFixed(2)})`, 52, 54);

  doc.setTextColor(126, 34, 206);
  doc.text(`${sameAddressCount} (R$ ${sameAddressTotal.toFixed(2)})`, 88, 54);

  doc.setTextColor(180, 83, 9);
  doc.text(`R$ ${totalAdditionals.toFixed(2)}`, 126, 54);

  doc.setTextColor(185, 28, 28);
  doc.text(`- R$ ${totalAdminCut.toFixed(2)}`, 158, 54);

  // Linha inferior do resumo com Valor Bruto e Valor Líquido em evidência
  doc.setFillColor(241, 245, 249);
  doc.rect(14, 60, 182, 10, 'F');
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text(`VALOR BRUTO TOTAL: R$ ${totalGross.toFixed(2)}`, 18, 66.5);

  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text(`VALOR LÍQUIDO A RECEBER (MOTOBOY): R$ ${totalRiderNet.toFixed(2)}`, 95, 66.5);

  // Tabela detalhada de corridas
  const tableData = activeDeliveries.map((del, idx) => {
    const est = establishments.find(e => e.id === del.establishmentId);
    const isSame = del.deliveryType === 'same_address' || Number(del.value) <= 4.00;
    const addVal = Number(del.additionalValue || 0);
    const admCut = getAdminFeeForDelivery(del);
    const net = getRiderNetForDelivery(del);
    const pm = del.paymentMethod || 'already_paid';
    
    let paymentDesc = 'Já Pago';
    if (pm === 'money') paymentDesc = 'Dinheiro';
    else if (pm === 'card_debit') paymentDesc = 'Débito';
    else if (pm === 'card_credit') paymentDesc = 'Crédito';
    else if (pm === 'pix_delivery') paymentDesc = 'PIX';

    let typeDesc = 'Padrão (R$ 8)';
    if (isSame) {
      typeDesc = `Mesmo End. (R$ 4)${del.linkedOrderNumber ? ` #${del.linkedOrderNumber}` : ''}`;
    } else if (addVal > 0) {
      typeDesc = `Padrão (+ R$ ${addVal.toFixed(2)} ${del.additionalReason ? `[${del.additionalReason}]` : ''})`;
    }

    return [
      `${idx + 1}`,
      `${new Date(del.date + 'T00:00:00').toLocaleDateString('pt-BR')} ${del.time}`,
      del.orderNumber ? `#${del.orderNumber}` : '-',
      est?.name || 'Estabelecimento',
      typeDesc,
      paymentDesc,
      `R$ ${Number(del.value).toFixed(2)}`,
      `R$ ${admCut.toFixed(2)}`,
      `R$ ${net.toFixed(2)}`,
      del.paid ? 'PAGO' : 'PENDENTE'
    ];
  });

  autoTable(doc, {
    startY: 74,
    head: [[
      '#',
      'Data/Hora',
      'Pedido / Corrida',
      'Estabelecimento',
      'Tipo de Corrida & Adicional',
      'Pag. Cliente',
      'VALOR BRUTO',
      'TAXA ADM',
      'VALOR LÍQUIDO',
      'Status'
    ]],
    body: tableData as any,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 17 },
      3: { halign: 'left', cellWidth: 35 },
      4: { halign: 'left', cellWidth: 35 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138], cellWidth: 16 },
      7: { halign: 'right', textColor: [185, 28, 28], cellWidth: 13 },
      8: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 17 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 14 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Assinaturas de Acerto ao final
  const finalY = (doc as any).lastAutoTable.finalY + 16;
  if (finalY < 255) {
    doc.setDrawColor(148, 163, 184);
    doc.line(20, finalY + 12, 90, finalY + 12);
    doc.line(120, finalY + 12, 190, finalY + 12);

    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Assinatura do Entregador', 35, finalY + 17);
    doc.text('Assinatura do Administrador', 133, finalY + 17);
  }

  // Rodapé
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Extrato de Acerto — ${rider.name} | MotoHub Delivery | Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  const cleanName = rider.name.toLowerCase().replace(/\s+/g, '_');
  const filename = `extrato_${cleanName}_${periodLabel.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
};