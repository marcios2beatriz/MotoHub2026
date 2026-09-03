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
  periodLabel
}: GeneratePdfGeneralOptions) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const nowStr = new Date().toLocaleString('pt-BR');

  // Cabeçalho
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('MOTOHUB DELIVERY', 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('Relatório Consolidado de Repasses e Faturamento de Entregadores', 14, 21);

  doc.setFontSize(8);
  doc.text(`Gerado em: ${nowStr} | Período: ${periodLabel}`, 14, 27);

  // Totais Gerais
  const activeDeliveries = deliveries.filter(d => d.status === 'active');
  const totalGross = activeDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalAdminCut = activeDeliveries.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
  const totalRidersNet = Math.max(0, totalGross - totalAdminCut);
  const totalAdditionals = activeDeliveries.reduce((sum, d) => sum + Number(d.additionalValue || 0), 0);
  const totalSameAddress = activeDeliveries.filter(d => d.deliveryType === 'same_address' || Number(d.value) <= 4.00).length;

  // Bloco de Métricas no topo
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(14, 38, 182, 22, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 38, 182, 22, 3, 3, 'S');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL DE CORRIDAS', 20, 45);
  doc.text('MESMO END. (R$4)', 60, 45);
  doc.text('+ ADICIONAIS', 100, 45);
  doc.text('TAXA ADM (R$1)', 135, 45);
  doc.text('TOTAL LÍQUIDO MOTOBOYS', 165, 45);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${activeDeliveries.length}`, 20, 53);

  doc.setTextColor(126, 34, 206);
  doc.text(`${totalSameAddress}`, 60, 53);

  doc.setTextColor(180, 83, 9);
  doc.text(`R$ ${totalAdditionals.toFixed(2)}`, 100, 53);

  doc.setTextColor(185, 28, 28);
  doc.text(`R$ ${totalAdminCut.toFixed(2)}`, 135, 53);

  doc.setTextColor(16, 185, 129);
  doc.text(`R$ ${totalRidersNet.toFixed(2)}`, 165, 53);

  // Tabela por Motoboy
  const tableData = riders
    .map(rider => {
      const riderDels = activeDeliveries.filter(d => d.riderId === rider.id);
      const count = riderDels.length;
      if (count === 0) return null;

      const gross = riderDels.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const sameAddrCount = riderDels.filter(d => d.deliveryType === 'same_address' || Number(d.value) <= 4.00).length;
      const adds = riderDels.reduce((sum, d) => sum + Number(d.additionalValue || 0), 0);
      const admCut = riderDels.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
      const net = Math.max(0, gross - admCut);
      const isPaid = riderDels.every(d => d.paid);

      return [
        rider.name,
        rider.phone || '-',
        `${count}`,
        `${sameAddrCount}`,
        `R$ ${adds.toFixed(2)}`,
        `R$ ${gross.toFixed(2)}`,
        `R$ ${admCut.toFixed(2)}`,
        `R$ ${net.toFixed(2)}`,
        isPaid ? 'PAGO' : 'A REPASSAR'
      ];
    })
    .filter(Boolean);

  autoTable(doc, {
    startY: 66,
    head: [[
      'Entregador',
      'Telefone',
      'Corridas',
      'Mesmo End.',
      '+ Adic.',
      'Bruto',
      'Taxa Adm',
      'Líquido Motoboy',
      'Status'
    ]],
    body: tableData as any,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229], // indigo-600
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', cellWidth: 38 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', textColor: [185, 28, 28], cellWidth: 18 },
      7: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 22 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 20 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Rodapé com numeração de página
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `MotoHub Delivery - Página ${i} de ${pageCount} | Documento Oficial de Fechamento`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  // Nome do arquivo
  const filename = `relatorio_geral_motoboys_${periodLabel.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
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

  // Cabeçalho
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('MOTOHUB DELIVERY', 14, 14);

  doc.setFontSize(11);
  doc.setTextColor(203, 213, 225);
  doc.text(`EXTRATO INDIVIDUAL DE REPASSE: ${rider.name.toUpperCase()}`, 14, 22);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`CPF: ${rider.cpf || 'Não informado'} | Telefone: ${rider.phone || 'Não informado'} | Período: ${periodLabel}`, 14, 29);

  // Totais do Motoboy
  const totalGross = activeDeliveries.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const totalAdminCut = activeDeliveries.reduce((sum, d) => sum + getAdminFeeForDelivery(d), 0);
  const totalRiderNet = Math.max(0, totalGross - totalAdminCut);
  const totalAdditionals = activeDeliveries.reduce((sum, d) => sum + Number(d.additionalValue || 0), 0);
  const totalSameAddress = activeDeliveries.filter(d => d.deliveryType === 'same_address' || Number(d.value) <= 4.00).length;

  // Caixa de Resumo
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 42, 182, 24, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 42, 182, 24, 3, 3, 'S');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL DE CORRIDAS', 20, 49);
  doc.text('MESMO END. (R$4)', 58, 49);
  doc.text('+ ADICIONAIS', 95, 49);
  doc.text('TAXA ADM (R$1)', 132, 49);
  doc.text('TOTAL LÍQUIDO A RECEBER', 162, 49);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`${activeDeliveries.length}`, 20, 58);

  doc.setTextColor(126, 34, 206);
  doc.text(`${totalSameAddress}`, 58, 58);

  doc.setTextColor(180, 83, 9);
  doc.text(`R$ ${totalAdditionals.toFixed(2)}`, 95, 58);

  doc.setTextColor(185, 28, 28);
  doc.text(`R$ ${totalAdminCut.toFixed(2)}`, 132, 58);

  doc.setTextColor(5, 150, 105);
  doc.text(`R$ ${totalRiderNet.toFixed(2)}`, 162, 58);

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

    const typeDesc = isSame 
      ? `Mesmo End. ${del.linkedOrderNumber ? `(#${del.linkedOrderNumber})` : ''}` 
      : addVal > 0 
      ? `Padrão (+ R$ ${addVal.toFixed(2)})` 
      : 'Padrão';

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
      'Pedido',
      'Estabelecimento',
      'Tipo de Corrida',
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
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      3: { halign: 'left', cellWidth: 38 },
      4: { halign: 'left', cellWidth: 30 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'right', cellWidth: 16 },
      7: { halign: 'right', textColor: [185, 28, 28], cellWidth: 14 },
      8: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105], cellWidth: 18 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 16 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Assinaturas de Acerto ao final
  const finalY = (doc as any).lastAutoTable.finalY + 18;
  if (finalY < 260) {
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
      doc.internal.pageSize.height - 10
    );
  }

  const cleanName = rider.name.toLowerCase().replace(/\s+/g, '_');
  const filename = `extrato_${cleanName}_${periodLabel.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
};