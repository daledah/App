import React from 'react';
import {Keyboard} from 'react-native';
import {useOnyx} from 'react-native-onyx';
import CategoryPicker from '@components/CategoryPicker';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';
import type {ListItem} from '@components/SelectionList/types';
import useThemeStyles from '@hooks/useThemeStyles';
import {setWorkspaceDefaultSpendCategory} from '@libs/actions/Policy/Policy';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';
import AccessOrNotFoundWrapper from '@pages/workspace/AccessOrNotFoundWrapper';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';

type WorkspaceCategoriesSettingsGroupSelectorPageProps = PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.WORKSPACE.CATEGORIES_SETTINGS_GROUP_SELECTOR>;

function WorkspaceCategoriesSettingsGroupSelectorPage({route}: WorkspaceCategoriesSettingsGroupSelectorPageProps) {
    const policyID = route.params.policyID;
    const styles = useThemeStyles();
    const groupID = route.params.groupID;
    const [categoryID] = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {
        selector: (policy) => {
            return policy?.mccGroup?.[groupID].category;
        },
    });

    const setNewCategory = (selectedCategory: ListItem) => {
        if (!selectedCategory.keyForList || !groupID) {
            return;
        }
        if (categoryID !== selectedCategory.keyForList) {
            setWorkspaceDefaultSpendCategory(policyID, groupID, selectedCategory.keyForList);
        }

        Keyboard.dismiss();
        Navigation.setNavigationActionToMicrotaskQueue(() => {
            Navigation.goBack(route.params.backTo);
        });
    };

    return (
        <AccessOrNotFoundWrapper
            policyID={policyID}
            accessVariants={[CONST.POLICY.ACCESS_VARIANTS.ADMIN, CONST.POLICY.ACCESS_VARIANTS.PAID]}
            featureName={CONST.POLICY.MORE_FEATURES.ARE_CATEGORIES_ENABLED}
        >
            <ScreenWrapper
                enableEdgeToEdgeBottomSafeAreaPadding
                style={[styles.defaultModalContainer]}
                testID={WorkspaceCategoriesSettingsGroupSelectorPage.displayName}
            >
                {!!categoryID && !!groupID && (
                    <>
                        <HeaderWithBackButton
                            title={groupID[0].toUpperCase() + groupID.slice(1)}
                            shouldShowBackButton
                            onBackButtonPress={() => {
                                Navigation.goBack(route.params.backTo);
                            }}
                        />
                        <CategoryPicker
                            policyID={policyID}
                            selectedCategory={categoryID}
                            onSubmit={setNewCategory}
                            contentContainerStyle={styles.pb5}
                            addBottomSafeAreaPadding
                        />
                    </>
                )}
            </ScreenWrapper>
        </AccessOrNotFoundWrapper>
    );
}

WorkspaceCategoriesSettingsGroupSelectorPage.displayName = 'WorkspaceCategoriesSettingsGroupSelectorPage';
export default WorkspaceCategoriesSettingsGroupSelectorPage;
