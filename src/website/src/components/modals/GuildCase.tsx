import { FormEvent, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Controller, useForm } from 'react-hook-form';
import { CaseAction } from '@yuudachi/types';
import {
	Box,
	Text,
	Button,
	Modal,
	ModalOverlay,
	ModalContent,
	ModalHeader,
	ModalCloseButton,
	ModalBody,
	ModalFooter,
	FormControl,
	FormLabel,
	Textarea,
	Center,
	ButtonGroup,
	NumberInput,
	NumberInputField,
	NumberInputStepper,
	NumberIncrementStepper,
	NumberDecrementStepper,
	useToast,
	FormErrorMessage,
	FormErrorIcon,
} from '@chakra-ui/react';
import TextareaAutosize from 'react-autosize-textarea';
import DatePicker from '~/components/DatePicker';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const Loading = dynamic(() => import('../Loading'));
const GuildCaseReference = dynamic(() => import('~/components/GuildCaseReference'));

import { useUserStore } from '~/store/index';

import { GuildCasePayload } from '~/interfaces/GuildCases';
import { GraphQLRole } from '~/interfaces/Role';

import { useQueryGuildCase } from '~/hooks/useQueryGuildCase';
import { useQueryGuildRoles } from '~/hooks/useQueryGuildRoles';
import { useQueryUser } from '~/hooks/useQueryUser';
import { useMutationUpdateGuildCase } from '~/hooks/useMutationUpdateGuildCase';

import { DATE_FORMAT_WITH_SECONDS } from 'src/Constants';

const GuildCase = ({
	caseId,
	readOnly = false,
	isOpen,
	onClose,
}: {
	caseId?: number;
	readOnly?: boolean;
	isOpen: boolean;
	onClose: () => void;
}) => {
	const user = useUserStore();
	const router = useRouter();
	const toast = useToast();
	const { handleSubmit, register, control, errors, formState } = useForm<GuildCasePayload>();
	const [expirationTime, setExpirationTime] = useState<string | null>(null);
	const { id } = router.query;

	const { data: gqlGuildCaseData, isLoading: isLoadingGuildCase } = useQueryGuildCase(
		id as string,
		caseId!,
		Boolean(caseId) && isOpen,
	);
	const { data: gqlGuildRolesData } = useQueryGuildRoles(id as string, isOpen);
	const { data: gqlUserData } = useQueryUser(user.id!, !Boolean(gqlGuildCaseData?.case.mod_id) && isOpen);
	const { mutateAsync: guildCaseUpdateMutate, isLoading: isLoadingGuildCaseUpdateMutate } = useMutationUpdateGuildCase(
		id as string,
		caseId!,
	);

	useEffect(() => {
		if (isOpen) {
			setExpirationTime(gqlGuildCaseData?.case.action_expiration ?? null);
		}
	}, [isOpen, gqlGuildCaseData?.case.action_expiration]);

	const handleOnSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		await handleSubmit(async (values: { expiration: Date | null; reference: number; reason: string }) => {
			const { reference, expiration, ...rest } = values;
			let payload: GuildCasePayload = {
				...rest,
				ref_id: reference || null,
				action_expiration: expiration?.toISOString() ?? null,
			};

			if (!gqlGuildCaseData?.case.mod_id) {
				if (gqlUserData) {
					payload = {
						...payload,
						mod_id: user.id!,
						mod_tag: `${gqlUserData.user.username as string}#${gqlUserData.user.discriminator as string}`,
					};
				}
			}

			await guildCaseUpdateMutate(payload, {
				onSuccess: () => {
					toast({
						title: 'Case edited.',
						description: `You successfully edited the case.`,
						status: 'success',
						isClosable: true,
						position: 'top',
					});
				},
			});

			onClose();
		})(event);
	};

	return (
		<Modal size="xl" isOpen={isOpen} onClose={onClose}>
			<ModalOverlay />
			<ModalContent>
				<ModalHeader>
					Case {gqlGuildCaseData ? `#${gqlGuildCaseData.case.case_id.toString() as string}` : ''}
				</ModalHeader>
				<ModalCloseButton />
				{isLoadingGuildCase ? (
					<Center h="100%">
						<Loading />
					</Center>
				) : (
					<>
						<ModalBody>
							<form id="guild-case-modal" onSubmit={handleOnSubmit}>
								<Box mb={4}>
									<FormLabel as="legend">Created at</FormLabel>
									<Text>
										{dayjs(gqlGuildCaseData?.case.created_at).format(DATE_FORMAT_WITH_SECONDS)} (UTC) (
										{dayjs(gqlGuildCaseData?.case.created_at).fromNow()})
									</Text>
								</Box>

								<FormControl id="reference" mb={4} isReadOnly={readOnly || user.role === GraphQLRole.user}>
									<FormLabel>Reference</FormLabel>
									<Box>
										<NumberInput
											d="inline-block"
											mr={2}
											top="3px"
											w={gqlGuildCaseData?.case.ref_id ? '80%' : '100%'}
											defaultValue={gqlGuildCaseData?.case.ref_id ?? undefined}
											isReadOnly={readOnly || user.role === GraphQLRole.user}
										>
											<NumberInputField name="reference" ref={register} />
											<NumberInputStepper>
												<NumberIncrementStepper />
												<NumberDecrementStepper />
											</NumberInputStepper>
										</NumberInput>
										{gqlGuildCaseData?.case.ref_id ? (
											<Box d="inline-block" bottom="3px">
												<GuildCaseReference caseId={gqlGuildCaseData.case.ref_id} size="md" />
											</Box>
										) : null}
									</Box>
								</FormControl>

								<Box mb={4}>
									<FormLabel as="legend">Action</FormLabel>
									<Text>
										{CaseAction[gqlGuildCaseData?.case.action ?? 0][0].toUpperCase() +
											CaseAction[gqlGuildCaseData?.case.action ?? 0].substr(1).toLowerCase()}
									</Text>
								</Box>

								{gqlGuildCaseData?.case.role_id ? (
									<Box mb={4}>
										<FormLabel as="legend">Role</FormLabel>
										<Text>
											{gqlGuildRolesData?.roles?.find((role) => role.id === gqlGuildCaseData.case.role_id)?.name} (
											{gqlGuildRolesData?.roles?.find((role) => role.id === gqlGuildCaseData.case.role_id)?.id})
										</Text>
									</Box>
								) : null}

								{gqlGuildCaseData?.case.action_expiration ? (
									<>
										<Box mb={4}>
											<FormLabel as="legend">Expiration</FormLabel>
											<Controller
												name="expiration"
												control={control}
												defaultValue={dayjs(gqlGuildCaseData.case.action_expiration).toDate()}
												render={(props: any) => (
													<DatePicker
														selectedDate={props.value}
														onChange={(d) => {
															if (isOpen) {
																setExpirationTime(d);
															}
															props.onChange(d);
														}}
														filterDate={(date) => dayjs(date).add(1, 'd') > dayjs(gqlGuildCaseData.case.created_at)}
														filterTime={(time) => {
															if (expirationTime) {
																if (dayjs(expirationTime).isSame(dayjs(), 'd')) {
																	return dayjs(time).add(-10, 'm') > dayjs(gqlGuildCaseData.case.created_at);
																}
																return dayjs(expirationTime).isAfter(dayjs(gqlGuildCaseData.case.created_at), 'd');
															}
															return false;
														}}
														isReadOnly={readOnly || user.role === GraphQLRole.user}
														isDisabled={gqlGuildCaseData.case.action_processed}
													/>
												)}
											/>
										</Box>

										<Box mb={4}>
											<FormLabel as="legend">Duration</FormLabel>
											<Text>
												{dayjs(gqlGuildCaseData.case.action_expiration).from(
													dayjs(gqlGuildCaseData.case.created_at),
													true,
												)}
											</Text>
										</Box>
									</>
								) : null}

								<Box mb={4}>
									<FormLabel as="legend">Moderator</FormLabel>
									<Text>{`${gqlGuildCaseData?.case.mod_tag as string} (${
										gqlGuildCaseData?.case.mod_id as string
									})`}</Text>
								</Box>

								<Box mb={4}>
									<FormLabel as="legend">Target</FormLabel>
									<Text>{`${gqlGuildCaseData?.case.target_tag as string} (${
										gqlGuildCaseData?.case.target_id as string
									})`}</Text>
								</Box>

								<FormControl
									id="reason"
									mb={4}
									isReadOnly={readOnly || user.role === GraphQLRole.user}
									isInvalid={Boolean(errors.reason)}
								>
									<FormLabel>Reason</FormLabel>
									<Textarea
										minH="unset"
										overflow="hidden"
										resize="none"
										name="reason"
										transition="height none"
										rows={5}
										ref={register({ maxLength: { value: 1900, message: 'Max length of 1900 exceeded' } })}
										as={TextareaAutosize as any /* fuck ts */}
										defaultValue={gqlGuildCaseData?.case.reason ?? undefined}
									/>
									<FormErrorMessage>
										<FormErrorIcon /> {errors.reason?.message}
									</FormErrorMessage>
								</FormControl>
							</form>
						</ModalBody>
						<ModalFooter>
							<ButtonGroup>
								<Button
									type="submit"
									form="guild-case-modal"
									colorScheme="green"
									isLoading={formState.isSubmitting || isLoadingGuildCaseUpdateMutate}
									loadingText="Submitting"
									isDisabled={readOnly || user.role === GraphQLRole.user}
								>
									Submit
								</Button>
								<Button onClick={onClose}>Close</Button>
							</ButtonGroup>
						</ModalFooter>
					</>
				)}
			</ModalContent>
		</Modal>
	);
};

export default GuildCase;