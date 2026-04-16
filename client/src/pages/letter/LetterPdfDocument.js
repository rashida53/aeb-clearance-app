import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import leftLogo from '../../assets/letterhead.png';
import rightLogo from '../../assets/maaliyah.png';

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
        color: '#555555',
        flex: 1,
    },

    divider: {
        borderBottomWidth: 1,
        borderBottomColor: '#dddddd',
        marginVertical: 20,
    },

    // Description
    descriptionLabel: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: GOLD,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 8,
    },
    descriptionValue: {
        fontSize: 13,
        color: '#333333',
        lineHeight: 1.7,
        borderLeftWidth: 3,
        borderLeftColor: GOLD,
        paddingLeft: 12,
    },

    // Status
    statusContainer: {
        marginTop: 36,
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#dddddd',
        paddingTop: 24,
        marginBottom: 24,
    },
    statusClear: {
        fontSize: 44,
        fontFamily: 'Helvetica-Bold',
        color: NAVY,
        letterSpacing: 3,
    },
    statusDuesPending: {
        fontSize: 31,
        fontFamily: 'Helvetica-Bold',
        color: NAVY,
        letterSpacing: 3,
    },

    // Balances table
    tableContainer: {
        marginTop: 8,
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
});

const LetterPdfDocument = ({ hofIts, hofName, reason, description, date, showLaagat, clearStatus, openBalances = [] }) => {
    const formattedDate = formatPdfDate(date);
    const total = openBalances.reduce((sum, b) => sum + (b.balance || 0), 0);

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

                {showLaagat ? (
                    <View style={styles.fieldRow}>
                        <Text style={styles.fieldLabel}>Laagat</Text>
                        <Text style={styles.laagatlNote}>Contact M Taaha bhai Bhora for Laagat</Text>
                    </View>
                ) : null}

                <View style={styles.divider} />

                <Text style={styles.descriptionLabel}>Description</Text>
                <Text style={styles.descriptionValue}>{description || '—'}</Text>

                <View style={styles.statusContainer}>
                    {clearStatus === 'CLEAR' ? (
                        <Text style={styles.statusClear}>CLEAR</Text>
                    ) : (
                        <Text style={styles.statusDuesPending}>PENDING</Text>
                    )}
                </View>

                {openBalances.length > 0 && (
                    <View style={styles.tableContainer}>
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

            </Page>
        </Document>
    );
};

export default LetterPdfDocument;
