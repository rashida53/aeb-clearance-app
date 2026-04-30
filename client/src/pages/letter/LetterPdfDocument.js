import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import leftLogo from '../../assets/letterhead.png';
import rightLogo from '../../assets/maaliyah.png';
import signBhora from '../../assets/aeb-treasurer.png';
import signRawat from '../../assets/aeb-secretary.png';
import sigRawat from '../../assets/rawat.png';
import sigBhora from '../../assets/bhora.png';

Font.registerHyphenationCallback(word => [word]);

const NAVY = '#00203D';
const GOLD = '#CE9C01';

const formatPdfDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month}, ${year}`;
};

const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const styles = StyleSheet.create({
    page: {
        backgroundColor: '#ffffff',
        padding: 52,
        fontFamily: 'Helvetica',
    },

    // Letterhead
    letterheadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: GOLD,
    },
    letterheadLogoLeft: {
        width: 72,
        height: 72,
        objectFit: 'contain',
    },
    letterheadLogoRight: {
        width: 60,
        height: 60,
        objectFit: 'contain',
    },
    letterheadTextBlock: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    letterheadTitle: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: NAVY,
        marginBottom: 5,
        textAlign: 'center',
    },
    letterheadSubtitle: {
        fontSize: 10,
        fontFamily: 'Helvetica-Oblique',
        color: NAVY,
        textAlign: 'center',
    },
    letterheadSpacer: {
        marginBottom: 24,
    },

    // Fields
    fieldRow: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-start',
    },
    fieldLabel: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: GOLD,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        width: 120,
        paddingTop: 1,
    },
    fieldValue: {
        fontSize: 13,
        color: '#222222',
        flex: 1,
    },
    laagatlNote: {
        fontSize: 13,
        color: '#222222',
        flex: 1,
    },

    // Balances table
    tableContainer: {
        marginTop: 8,
    },
    pledgesHeader: {
        fontSize: 14,
        fontFamily: 'Helvetica-Bold',
        color: NAVY,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 6,
        textAlign: 'center',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        backgroundColor: NAVY,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#eeeeee',
        backgroundColor: '#f9f9f9',
    },
    tableRowDue: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#c04040',
        backgroundColor: '#d15252',
    },
    tableTotalRow: {
        flexDirection: 'row',
        backgroundColor: '#f0f0f0',
        borderTopWidth: 2,
        borderTopColor: NAVY,
    },
    tableCol: {
        width: '33.33%',
        padding: 8,
        textAlign: 'center',
    },
    tableHeaderText: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: GOLD,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    tableCellText: {
        fontSize: 11,
        color: '#333333',
        textAlign: 'center',
    },
    tableCellTextDue: {
        fontSize: 11,
        color: '#ffffff',
        textAlign: 'center',
    },
    tableTotalLabel: {
        width: '33.33%',
        padding: 8,
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
        color: NAVY,
    },
    tableTotalValue: {
        width: '66.67%',
        padding: 8,
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
        color: NAVY,
        textAlign: 'right',
    },

    // Approval remarks
    approvalRemarksRow: {
        flexDirection: 'row',
        marginTop: 16,
        alignItems: 'flex-start',
    },

    // Signature
    signatureContainer: {
        position: 'absolute',
        bottom: 40,
        right: 52,
        alignItems: 'flex-end',
    },
    signatureImage: {
        width: 183,
        height: 183,
        objectFit: 'contain',
    },

    approvalContainer: {
        position: 'absolute',
        bottom: 40,
        left: 52,
    },
    approvalText: {
        fontSize: 11,
        color: '#000000',
        marginBottom: 4,
    },
    approvalSignatureImage: {
        width: 192,
        height: 96,
        objectFit: 'contain',
        marginBottom: 4,
    },
});

const APPROVER_RAWAT = 'Shk Murtaza Rawat';
const APPROVER_BHORA = 'M Taaha Bhora';

const APPROVER_SIGNATURES = {
    [APPROVER_RAWAT]: { stamp: signRawat, signature: sigRawat },
    [APPROVER_BHORA]: { stamp: signBhora, signature: sigBhora },
};

const getApproverAssets = (approved, approverName, hasOpenBalances) => {
    if (!approved) return { stamp: null, signature: null };
    if (!hasOpenBalances) return { stamp: signBhora, signature: sigBhora };
    return APPROVER_SIGNATURES[approverName] || { stamp: null, signature: null };
};

const LetterPdfDocument = ({ hofIts, hofName, reason, description, date, showLaagat, laagatAmount, sarkaariLaagat, jamaatLaagat, openBalances = [], approved, approvalRemarks, approverName }) => {
    const formattedDate = formatPdfDate(date);
    const total = openBalances.reduce((sum, b) => sum + (b.balance || 0), 0);
    const { stamp: signatureImg, signature: approverSigImg } = getApproverAssets(approved, approverName, openBalances.length > 0);

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <View style={styles.letterheadRow}>
                    <Image src={leftLogo} style={styles.letterheadLogoLeft} />
                    <View style={styles.letterheadTextBlock}>
                        <Text style={styles.letterheadTitle}>Anjuman-e-Burhani (Austin) Inc.</Text>
                        <Text style={styles.letterheadSubtitle}>
                            A nonprofit Corporation administering &amp; managing the affairs of the Dawoodi Bohra Jamaat of Austin
                        </Text>
                    </View>
                    <Image src={rightLogo} style={styles.letterheadLogoRight} />
                </View>

                <View style={styles.letterheadSpacer} />

                <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>HOF ITS</Text>
                    <Text style={styles.fieldValue}>{hofIts || '—'}</Text>
                </View>

                <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>HOF Name</Text>
                    <Text style={styles.fieldValue}>{hofName || '—'}</Text>
                </View>

                <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Reason</Text>
                    <Text style={styles.fieldValue}>{reason || '—'}</Text>
                </View>

                {formattedDate ? (
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Date</Text>
                        <Text style={styles.fieldValue}>{formattedDate}</Text>
                    </View>
                ) : null}

                {showLaagat && sarkaariLaagat != null ? (
                    <>
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Sarkaari</Text>
                            <Text style={styles.laagatlNote}>${sarkaariLaagat}</Text>
                        </View>
                        <View style={styles.fieldRow}>
                            <Text style={styles.fieldLabel}>Jamaat</Text>
                            <Text style={styles.laagatlNote}>${jamaatLaagat}</Text>
                        </View>
                    </>
                ) : showLaagat && laagatAmount != null ? (
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Laagat</Text>
                        <Text style={styles.laagatlNote}>${laagatAmount}</Text>
                    </View>
                ) : null}

                <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <Text style={styles.fieldValue}>{description || '—'}</Text>
                </View>

                {openBalances.length > 0 && (
                    <View style={styles.tableContainer}>
                        <Text style={styles.pledgesHeader}>PLEDGES</Text>
                        <View style={styles.tableHeaderRow}>
                            <Text style={[styles.tableCol, styles.tableHeaderText]}>Pledge</Text>
                            <Text style={[styles.tableCol, styles.tableHeaderText]}>Amount</Text>
                            <Text style={[styles.tableCol, styles.tableHeaderText]}>Balance</Text>
                        </View>
                        {openBalances.map((b, i) => {
                            const isDue = b.balance === b.amount;
                            const cellStyle = isDue ? styles.tableCellTextDue : styles.tableCellText;
                            return (
                                <View key={i} style={isDue ? styles.tableRowDue : styles.tableRow}>
                                    <Text style={[styles.tableCol, cellStyle]}>{b.qb_id}</Text>
                                    <Text style={[styles.tableCol, cellStyle]}>{b.amount != null ? formatCurrency(b.amount) : '—'}</Text>
                                    <Text style={[styles.tableCol, cellStyle]}>{formatCurrency(b.balance)}</Text>
                                </View>
                            );
                        })}
                        <View style={styles.tableTotalRow}>
                            <Text style={styles.tableTotalLabel}>Total</Text>
                            <Text style={styles.tableTotalValue}>{formatCurrency(total)}</Text>
                        </View>
                    </View>
                )}

                {approved && approvalRemarks ? (
                    <View style={styles.approvalRemarksRow}>
                        <Text style={styles.fieldLabel}>Approval Remarks</Text>
                        <Text style={styles.fieldValue}>{approvalRemarks}</Text>
                    </View>
                ) : null}

                {approved && (
                    <View style={styles.approvalContainer}>
                        {approverSigImg && (
                            <Image src={approverSigImg} style={styles.approvalSignatureImage} />
                        )}
                        <Text style={styles.approvalText}>Approver: Abd e Syedna TUS {approverName}</Text>
                        <Text style={styles.approvalText}>Date: {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</Text>
                    </View>
                )}

                {signatureImg && (
                    <View style={styles.signatureContainer}>
                        <Image src={signatureImg} style={styles.signatureImage} />
                    </View>
                )}

            </Page>
        </Document>
    );
};

export default LetterPdfDocument;
