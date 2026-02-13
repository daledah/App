import React, {useMemo} from 'react';
import {View} from 'react-native';
import DragAndDropConsumer from '@components/DragAndDrop/Consumer';
import DragAndDropProvider from '@components/DragAndDrop/Provider';
import DropZoneUI from '@components/DropZone/DropZoneUI';
import NavigationTabBar from '@components/Navigation/NavigationTabBar';
import NAVIGATION_TABS from '@components/Navigation/NavigationTabBar/NAVIGATION_TABS';
import TopBar from '@components/Navigation/TopBar';
import ScreenWrapper from '@components/ScreenWrapper';
import ScrollView from '@components/ScrollView';
import useConfirmReadyToOpenApp from '@hooks/useConfirmReadyToOpenApp';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useFilesValidation from '@hooks/useFilesValidation';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useSelfDMReport from '@hooks/useSelfDMReport';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {setTransactionReport} from '@libs/actions/Transaction';
import {navigateToParticipantPage} from '@libs/IOUUtils';
import usePreloadFullScreenNavigators from '@libs/Navigation/AppNavigator/usePreloadFullScreenNavigators';
import Navigation from '@libs/Navigation/Navigation';
import {hasOnlyPersonalPolicies as hasOnlyPersonalPoliciesUtil, isPaidGroupPolicy} from '@libs/PolicyUtils';
import {generateReportID, getPolicyExpenseChat, isSelfDM} from '@libs/ReportUtils';
import {shouldRestrictUserBillableActions} from '@libs/SubscriptionUtils';
import type {ReceiptFile} from '@pages/iou/request/step/IOURequestStepScan/types';
import {initMoneyRequest, setMoneyRequestParticipantsFromReport, setMoneyRequestReceipt} from '@userActions/IOU';
import {buildOptimisticTransactionAndCreateDraft} from '@userActions/TransactionEdit';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Transaction} from '@src/types/onyx';
import type {FileObject} from '@src/types/utils/Attachment';
import AnnouncementSection from './AnnouncementSection';
import DiscoverSection from './DiscoverSection';
import ForYouSection from './ForYouSection';
import TimeSensitiveSection from './TimeSensitiveSection';

function HomePage() {
    const {shouldUseNarrowLayout} = useResponsiveLayout();
    const shouldDisplayLHB = !shouldUseNarrowLayout;
    const styles = useThemeStyles();
    const theme = useTheme();
    const {translate} = useLocalize();
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const selfDMReport = useSelfDMReport();

    const [policies] = useOnyx(ONYXKEYS.COLLECTION.POLICY, {canBeMissing: true});
    const [currentDate] = useOnyx(ONYXKEYS.CURRENT_DATE, {canBeMissing: true});
    const [activePolicyID] = useOnyx(ONYXKEYS.NVP_ACTIVE_POLICY_ID, {canBeMissing: false});
    const [activePolicy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${activePolicyID}`, {canBeMissing: true});
    const [personalPolicyID] = useOnyx(ONYXKEYS.PERSONAL_POLICY_ID, {canBeMissing: true});
    const [personalPolicy] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${personalPolicyID}`, {canBeMissing: true});
    const [draftTransactions] = useOnyx(ONYXKEYS.COLLECTION.TRANSACTION_DRAFT, {canBeMissing: true});

    const newReportID = useMemo(() => generateReportID(), []);
    const [newReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${newReportID}`, {canBeMissing: true});
    const [newParentReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${newReport?.parentReportID}`, {canBeMissing: true});

    const hasOnlyPersonalPolicies = useMemo(() => hasOnlyPersonalPoliciesUtil(policies), [policies]);
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['SmartScan'] as const);

    // This hook signals that the app is ready to be opened after HomePage mounts
    // to make sure everything loads properly
    useConfirmReadyToOpenApp();

    // This hook preloads the screens of adjacent tabs to make changing tabs faster.
    usePreloadFullScreenNavigators();

    const saveFileAndInitMoneyRequest = (files: FileObject[]) => {
        const initialTransaction = initMoneyRequest({
            isFromGlobalCreate: true,
            isFromFloatingActionButton: true,
            reportID: newReportID,
            personalPolicy,
            newIouRequestType: CONST.IOU.REQUEST_TYPE.SCAN,
            report: newReport,
            parentReport: newParentReport,
            currentDate,
            currentUserPersonalDetails,
            hasOnlyPersonalPolicies,
            draftTransactions,
        });

        const newReceiptFiles: ReceiptFile[] = [];

        for (const [index, file] of files.entries()) {
            const source = URL.createObjectURL(file as Blob);
            const transaction =
                index === 0
                    ? (initialTransaction as Partial<Transaction>)
                    : buildOptimisticTransactionAndCreateDraft({
                          initialTransaction: initialTransaction as Partial<Transaction>,
                          currentUserPersonalDetails,
                          reportID: newReportID,
                      });
            const transactionID = transaction.transactionID ?? CONST.IOU.OPTIMISTIC_TRANSACTION_ID;
            newReceiptFiles.push({
                file,
                source,
                transactionID,
            });
            setMoneyRequestReceipt(transactionID, source, file.name ?? '', true, file.type);
        }

        if (isPaidGroupPolicy(activePolicy) && activePolicy?.isPolicyExpenseChatEnabled && !shouldRestrictUserBillableActions(activePolicy.id)) {
            const shouldAutoReport = !!activePolicy?.autoReporting || !!personalPolicy?.autoReporting;
            const report = shouldAutoReport ? getPolicyExpenseChat(currentUserPersonalDetails.accountID, activePolicy?.id) : selfDMReport;
            const transactionReportID = isSelfDM(report) ? CONST.REPORT.UNREPORTED_REPORT_ID : report?.reportID;
            const iouTypeTrackOrSubmit = transactionReportID === CONST.REPORT.UNREPORTED_REPORT_ID ? CONST.IOU.TYPE.TRACK : CONST.IOU.TYPE.SUBMIT;
            const setParticipantsPromises = newReceiptFiles.map((receiptFile) => {
                setTransactionReport(receiptFile.transactionID, {reportID: transactionReportID}, true);
                return setMoneyRequestParticipantsFromReport(receiptFile.transactionID, report, currentUserPersonalDetails.accountID);
            });
            Promise.all(setParticipantsPromises).then(() =>
                Navigation.navigate(
                    ROUTES.MONEY_REQUEST_STEP_CONFIRMATION.getRoute(
                        CONST.IOU.ACTION.CREATE,
                        iouTypeTrackOrSubmit,
                        initialTransaction?.transactionID ?? CONST.IOU.OPTIMISTIC_TRANSACTION_ID,
                        report?.reportID,
                    ),
                ),
            );
        } else {
            navigateToParticipantPage(CONST.IOU.TYPE.CREATE, CONST.IOU.OPTIMISTIC_TRANSACTION_ID, newReportID);
        }
    };

    const {validateFiles, PDFValidationComponent, ErrorModal} = useFilesValidation(saveFileAndInitMoneyRequest);

    const initScanRequest = (e: DragEvent) => {
        const files = Array.from(e?.dataTransfer?.files ?? []);

        if (files.length === 0) {
            return;
        }
        for (const file of files) {
            // eslint-disable-next-line no-param-reassign
            file.uri = URL.createObjectURL(file);
        }

        validateFiles(files, Array.from(e.dataTransfer?.items ?? []));
    };

    return (
        <View style={styles.flex1}>
            <DragAndDropProvider>
                {PDFValidationComponent}
                <ScreenWrapper
                    shouldEnablePickerAvoiding={false}
                    shouldShowOfflineIndicatorInWideScreen
                    testID="HomePage"
                    enableEdgeToEdgeBottomSafeAreaPadding={false}
                    bottomContent={
                        shouldUseNarrowLayout && (
                            <NavigationTabBar
                                selectedTab={NAVIGATION_TABS.HOME}
                                shouldShowFloatingButtons
                            />
                        )
                    }
                >
                    <TopBar
                        breadcrumbLabel={translate('common.home')}
                        shouldShowLoadingBar={false}
                    />
                    <ScrollView
                        contentContainerStyle={styles.homePageContentContainer}
                        addBottomSafeAreaPadding
                    >
                        <View style={styles.homePageMainLayout(shouldUseNarrowLayout)}>
                            {/* Widgets handle their own visibility and may return null to avoid duplicating visibility logic here */}
                            <View style={styles.homePageLeftColumn(shouldUseNarrowLayout)}>
                                <TimeSensitiveSection />
                                <ForYouSection />
                                <DiscoverSection />
                            </View>
                            <View style={styles.homePageRightColumn(shouldUseNarrowLayout)}>
                                <AnnouncementSection />
                            </View>
                        </View>
                    </ScrollView>
                    {shouldDisplayLHB && <NavigationTabBar selectedTab={NAVIGATION_TABS.HOME} />}
                </ScreenWrapper>
                <DragAndDropConsumer onDrop={initScanRequest}>
                    <DropZoneUI
                        icon={expensifyIcons.SmartScan}
                        dropTitle={translate('dropzone.scanReceipts')}
                        dropStyles={styles.receiptDropOverlay(true)}
                        dropTextStyles={styles.receiptDropText}
                        dashedBorderStyles={[styles.dropzoneArea, styles.easeInOpacityTransition, styles.activeDropzoneDashedBorder(theme.receiptDropBorderColorActive, true)]}
                    />
                </DragAndDropConsumer>
                {ErrorModal}
            </DragAndDropProvider>
        </View>
    );
}

export default HomePage;
