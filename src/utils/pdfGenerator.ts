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

  // Totais Gerais
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

  // Cabeçalho Paisagem
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 297, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MOTOHUB DELIVERY - RELATÓRIO CONSOLIDADO DE FECHAMENTO', 14, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Período de Apuração: ${periodLabel} | Gerado em: ${nowStr} | Entregadores Selecionados: ${targetRiders.length}`, 14, 19);

  // Bloco de Resumo em Cards
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 33, 269, 20, 2.5, 2.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 33, 269, 20, 2.5, 2.5, 'S');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL CORRIDAS', 20, 39);
  doc.text('PADRÃO (R$ 8,00)', 62, 39);
  doc.text('MESMO END. (R$ 4,00)', 110, 39);
  doc.text('+ ADICIONAIS', 160, 39);
  doc.text('TAXA ADM (R$ 1,00)', 205, 39);
  doc.text('LÍQUIDO A REPASSAR', 250, 39);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${relevantDeliveries.length}`, 20, 47);

  doc.setTextColor(30, 41, 59);
  doc.text(`${totalStandardCount} (R$ ${totalStandardValue.toFixed(2)})`, 62, 47);

  doc.setTextColor(126, 34, 206);
  doc.text(`${totalSameAddressCount} (R$ ${totalSameAddressValue.toFixed(2)})`, 110, 47);

  doc.setTextColor(180, 83, 9);
  doc.text(`R$ ${totalAdditionals.toFixed(2)}`, 160, 47);

  doc.setTextColor(185, 28, 28);
  doc.text(`R$ ${totalAdminCut.toFixed(2)}`, 205, 47);

  doc.setTextColor(5, 150, 105);
  doc.text(`R$ ${totalRidersNet.toFixed(2)}`, 250, 47);

  // Tabela Consolidada com ou sem coluna de números dos pedidos
  const headers = [
    '#',
    'Entregador (Motoboy)',
    'Telefone / CPF',
    'Total',
    ...(includeOrderNumbers ? ['Nº Pedidos / Corridas'] : []),
    'Padrão (R$ 8)',
    'Mesmo End. (R$ 4)',
    '+ Adicionais',
    'Bruto Total',
    'Taxa Adm (R$ 1)',
    'Líquido Motoboy',
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
    1: { fontStyle: 'bold', halign: 'left', cellWidth: 36 },
    2: { halign: 'center', cellWidth: 24 },
    3: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
    4: { halign: 'left', cellWidth: 42, fontStyle: 'normal', textColor: [71, 85, 105] }, // Nº Pedidos
    5: { halign: 'center', cellWidth: 26 },
    6: { halign: 'center', textColor: [126, 34, 206], cellWidth: 26 },
    7: { halign: 'right', textColor: [180, 83, 9], cellWidth: 18 },
    8: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
    9: { halign: 'right', textColor: [185, 28, 28], cellWidth: 18 },
    10: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 20 },
    11: { halign: 'center', fontStyle: 'bold', cellWidth: 18 }
  } : {
    0: { halign: 'center', cellWidth: 8 },
    1: { fontStyle: 'bold', halign: 'left', cellWidth: 46 },
    2: { halign: 'center', cellWidth: 28 },
    3: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
    4: { halign: 'center', cellWidth: 32 },
    5: { halign: 'center', textColor: [126, 34, 206], cellWidth: 32 },
    6: { halign: 'right', textColor: [180, 83, 9], cellWidth: 22 },
    7: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
    8: { halign: 'right', textColor: [185, 28, 28], cellWidth: 22 },
    9: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 26 },
    10: { halign: 'center', fontStyle: 'bold', cellWidth: 21 }
  };

  autoTable(doc, {
    startY: 57,
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
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  if (finalY < 185) {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, finalY, 269, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL GERAL ACUMULADO (${relevantDeliveries.length} corridas):`, 18, finalY + 6);
    doc.text(`Bruto: R$ ${totalGross.toFixed(2)}`, 140, finalY + 6);
    doc.setTextColor(185, 28, 28);
    doc.text(`Taxa Adm: R$ ${totalAdminCut.toFixed(2)}`, 190, finalY + 6);
    doc.setTextColor(5, 150, 105);
    doc.text(`Líquido a Pagar: R$ ${totalRidersNet.toFixed(2)}`, 235, finalY + 6);
  }

  // Rodapé com numeração de página
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MotoHub Delivery - Página ${i} de ${pageCount} | Documento Oficial de Fechamento Financeiro`,
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

  // Caixa de Resumo de 6 Métricas
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 40, 182, 28, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 40, 182, 28, 3, 3, 'S');

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL CORRIDAS', 18, 46);
  doc.text('PADRÃO (R$ 8,00)', 52, 46);
  doc.text('MESMO END. (R$ 4,00)', 88, 46);
  doc.text('+ ADICIONAIS', 124, 46);
  doc.text('TAXA ADM (R$ 1)', 154, 46);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${activeDeliveries.length}`, 18, 54);

  doc.setTextColor(30, 41, 59);
  doc.text(`${standardCount} (R$ ${standardTotal.toFixed(2)})`, 52, 54);

  doc.setTextColor(126, 34, 206);
  doc.text(`${sameAddressCount} (R$ ${sameAddressTotal.toFixed(2)})`, 88, 54);

  doc.setTextColor(180, 83, 9);
  doc.text(`R$ ${totalAdditionals.toFixed(2)}`, 124, 54);

  doc.setTextColor(185, 28, 28);
  doc.text(`- R$ ${totalAdminCut.toFixed(2)}`, 154, 54);

  // Linha inferior do resumo: Bruto Total vs Líquido Final a Receber
  doc.setFillColor(241, 245, 249);
  doc.rect(14, 60, 182, 8, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Bruto Total: R$ ${totalGross.toFixed(2)}`, 18, 65.5);

  doc.setTextColor(5, 150, 105);
  doc.text(`VALOR LÍQUIDO A RECEBER: R$ ${totalRiderNet.toFixed(2)}`, 105, 65.5);

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
    startY: 72,
    head: [[
      '#',
      'Data/Hora',
      'Pedido / Corrida',
      'Estabelecimento',
      'Tipo de Corrida & Adicional',
      'Pag. Cliente',
      'Bruto',
      'Taxa Adm',
      'Líquido',
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
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      3: { halign: 'left', cellWidth: 35 },
      4: { halign: 'left', cellWidth: 35 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 15 },
      7: { halign: 'right', textColor: [185, 28, 28], cellWidth: 13 },
      8: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 16 },
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
      `Extrato de Acerto - ${rider.name} | MotoHub Delivery | Página ${i} de ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  const cleanName = rider.name.toLowerCase().replace(/\s+/g, '_');
  const filename = `extrato_${cleanName}_${periodLabel.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
};