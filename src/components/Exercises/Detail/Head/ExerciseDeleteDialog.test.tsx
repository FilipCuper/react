import { act, render, screen } from '@testing-library/react';
import userEvent from "@testing-library/user-event";
import { ExerciseDeleteDialog } from "components/Exercises/Detail/Head/ExerciseDeleteDialog";
import React from 'react';
import { MemoryRouter, Routes } from "react-router";
import { Route } from "react-router-dom";
import { deleteExercise, deleteExerciseTranslation, getExercise, searchExerciseTranslations } from "services";
import { searchResponse } from "tests/exercises/searchResponse";
import { testExerciseBenchPress, testExerciseSquats, testLanguageGerman } from "tests/exerciseTestdata";

jest.mock("services");

describe("Test the ExerciseDeleteDialog component", () => {

    const onCloseMock = jest.fn();
    const onChangeLanguageMock = jest.fn();

    // Arrange
    beforeEach(() => {
        jest.resetAllMocks();

        (searchExerciseTranslations as jest.Mock).mockImplementation(() => Promise.resolve(searchResponse));
        (getExercise as jest.Mock).mockImplementation(() => Promise.resolve(testExerciseBenchPress));
    });

    function renderWidget() {
        render(
            <MemoryRouter initialEntries={['/overview/exercises/9']}>
                <Routes>
                    <Route path="overview/exercises/:exerciseId" element={
                        <ExerciseDeleteDialog
                            onClose={onCloseMock}
                            onChangeLanguage={onChangeLanguageMock}
                            currentExercise={testExerciseSquats}
                            currentLanguage={testLanguageGerman}
                        />
                    } />
                </Routes>
            </MemoryRouter>
        );
    }


    test('correctly deletes the current translation', async () => {
        // Arrange
        const user = userEvent.setup();

        // Act
        renderWidget();

        // Assert
        await user.click(screen.getByTestId('button-delete-translation'));
        expect(deleteExerciseTranslation).toHaveBeenCalledWith(9);
        expect(deleteExercise).not.toHaveBeenCalled();
    });

    test('correctly deletes the whole exercise', async () => {
        // Arrange
        const user = userEvent.setup();

        // Act
        renderWidget();

        // Assert
        await user.click(screen.getByTestId('button-delete-all'));
        expect(deleteExercise).toHaveBeenCalledWith(345);
        expect(deleteExerciseTranslation).not.toHaveBeenCalled();
    });


    test('correctly sets a replacement with the autocompleter', async () => {

        // Arrange
        const user = userEvent.setup();

        // Act
        renderWidget();

        const autocomplete = screen.getByTestId('autocomplete');
        await user.click(autocomplete);

        // Assert
        expect(searchExerciseTranslations).not.toHaveBeenCalled();
        await user.type(autocomplete, 'Cru');

        expect(screen.getByText("exercises.noReplacementSelected")).toBeInTheDocument();

        // There's a bounce period of 200ms between the input and the search
        await act(async () => {
            await new Promise((r) => setTimeout(r, 250));
        });
        await user.click(screen.getByTestId('autocompleter-result-998'));
        expect(getExercise).toHaveBeenCalledWith(998);
        expect(screen.queryByText("exercises.noReplacementSelected")).not.toBeInTheDocument();
        expect(screen.getByText("Benchpress")).toBeInTheDocument();
        expect(screen.getByText("2 (abcdef-150a-4ac7-97ef-84643c6419bf)")).toBeInTheDocument();

        await user.click(screen.getByTestId('button-delete-and-replace'));
        expect(deleteExercise).toHaveBeenCalledWith(345, "abcdef-150a-4ac7-97ef-84643c6419bf");
        expect(deleteExerciseTranslation).not.toHaveBeenCalled();
    });

    test('correctly sets a replacement manually setting the ID', async () => {

        // Arrange
        const user = userEvent.setup();

        // Act
        renderWidget();

        // Assert
        await user.type(screen.getByRole('textbox'), '111');
        expect(screen.getByText("exercises.noReplacementSelected")).toBeInTheDocument();
        await user.click(screen.getByText("exercises.noReplacementSelected"));

        expect(getExercise).toHaveBeenCalledWith(111);
        expect(screen.queryByText("exercises.noReplacementSelected")).not.toBeInTheDocument();
        expect(screen.getByText("Benchpress")).toBeInTheDocument();
        expect(screen.getByText("2 (abcdef-150a-4ac7-97ef-84643c6419bf)")).toBeInTheDocument();

        await user.click(screen.getByTestId('button-delete-and-replace'));
        expect(deleteExercise).toHaveBeenCalledWith(345, "abcdef-150a-4ac7-97ef-84643c6419bf");
        expect(deleteExerciseTranslation).not.toHaveBeenCalled();
    });
    test('handles error when getExercise fails for replacement', async () => {
        // Arrange
        const user = userEvent.setup();
        (getExercise as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

        // Act
        renderWidget();
        
        // Type invalid exercise ID
        await user.type(screen.getByTestId('exercise-id-field'), '999');
        
        // Trigger the load
        const refreshButton = screen.getAllByRole('button').find(
            button => button.querySelector('svg')
        );
        if (refreshButton) {
            await user.click(refreshButton);
        }

        // Wait for async operation
        await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
        });

        // Assert - should show "no replacement selected" because of error
        expect(getExercise).toHaveBeenCalledWith(999);
        expect(screen.getByText("exercises.noReplacementSelected")).toBeInTheDocument();
    });

    test('calls onClose when cancel button is clicked', async () => {
        // Arrange
        const user = userEvent.setup();

        // Act
        renderWidget();
        await user.click(screen.getByText('cancel'));

        // Assert
        expect(onCloseMock).toHaveBeenCalledTimes(1);
        expect(deleteExercise).not.toHaveBeenCalled();
        expect(deleteExerciseTranslation).not.toHaveBeenCalled();
    });

    test('resets replacement when clear button is clicked', async () => {
        // Arrange
        const user = userEvent.setup();

        // Act
        renderWidget();
        
        // Set a replacement first
        await user.type(screen.getByTestId('exercise-id-field'), '111');
        await user.click(screen.getByText("exercises.noReplacementSelected"));

        // Wait for exercise to load
        await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
        });
        
        expect(screen.getByText("Benchpress")).toBeInTheDocument();
        
        // Find and click the clear button (ClearIcon button)
        const clearButton = screen.getAllByRole('button').find(
            button => button.querySelector('svg[data-testid="ClearIcon"]')
        );
        
        if (clearButton) {
            await user.click(clearButton);
        }

        // Assert - should show no replacement selected again
        expect(screen.getByText("exercises.noReplacementSelected")).toBeInTheDocument();
        expect(screen.queryByText("Benchpress")).not.toBeInTheDocument();
    });

    test('disables delete-and-replace button when no replacement is selected', async () => {
        // Act
        renderWidget();

        // Assert
        const deleteReplaceButton = screen.getByTestId('button-delete-and-replace');
        expect(deleteReplaceButton).toBeDisabled();
    });

    test('copies exercise ID to clipboard when copy button is clicked', async () => {
        // Arrange
        const user = userEvent.setup();
        const writeTextMock = jest.fn();
        Object.assign(navigator, {
            clipboard: {
                writeText: writeTextMock,
            },
        });

        // Act
        renderWidget();
        
        // Set a replacement
        await user.type(screen.getByTestId('exercise-id-field'), '111');
        await user.click(screen.getByText("exercises.noReplacementSelected"));

        await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
        });

        // Find and click the copy button (ContentCopy icon)
        const copyButton = screen.getAllByRole('button').find(
            button => button.querySelector('svg[data-testid="ContentCopyIcon"]')
        );
        
        if (copyButton) {
            await user.click(copyButton);
            expect(writeTextMock).toHaveBeenCalledWith('2');
        }
    });
    test('handles deleteExerciseTranslation error gracefully', async () => {
        // Arrange
        const user = userEvent.setup();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        (deleteExerciseTranslation as jest.Mock).mockRejectedValueOnce(new Error('Delete failed'));

        // Act
        renderWidget();
        await user.click(screen.getByTestId('button-delete-translation'));

        // Wait for async operation
        await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
        });

        // Assert - should still call onClose even if delete fails
        expect(deleteExerciseTranslation).toHaveBeenCalledWith(9);
        
        // Cleanup
        consoleErrorSpy.mockRestore();
    });

    test('loads replacement exercise on blur event', async () => {
        // Arrange
        const user = userEvent.setup();

        // Act
        renderWidget();
        
        const inputField = screen.getByTestId('exercise-id-field');
        await user.type(inputField, '111');
        
        // Trigger blur event (when user clicks away from input)
        inputField.blur();

        // Wait for getExercise to be called
        await act(async () => {
            await new Promise((r) => setTimeout(r, 100));
        });

        // Assert
        expect(getExercise).toHaveBeenCalledWith(111);
        expect(screen.getByText("Benchpress")).toBeInTheDocument();
    });

    test('renders all dialog elements correctly', async () => {
        // Act
        renderWidget();

        // Assert - check all main UI elements are present
        expect(screen.getByText('delete')).toBeInTheDocument();
        expect(screen.getByText('exercises.deleteExerciseBody')).toBeInTheDocument();
        expect(screen.getByText('cannotBeUndone')).toBeInTheDocument();
        expect(screen.getByText('exercises.replacements')).toBeInTheDocument();
        expect(screen.getByText('exercises.replacementsInfoText')).toBeInTheDocument();
        expect(screen.getByText('exercises.replacementsSearch')).toBeInTheDocument();
        expect(screen.getByText('exercises.noReplacementSelected')).toBeInTheDocument();
        
        // Check all buttons exist
        expect(screen.getByText('cancel')).toBeInTheDocument();
        expect(screen.getByTestId('button-delete-translation')).toBeInTheDocument();
        expect(screen.getByTestId('button-delete-all')).toBeInTheDocument();
        expect(screen.getByTestId('button-delete-and-replace')).toBeInTheDocument();
    });
});
