/**
 * @param {import('../../app/components/Example.mjs').ControlOptions} options - The options.
 * @returns {JSX.Element} The returned JSX Element.
 */
export const controls = ({ observer, ReactPCUI, React, jsx, fragment }) => {
    const { BindingTwoWay, LabelGroup, SelectInput, SliderInput, Button, Panel } = ReactPCUI;

    return fragment(
        jsx(
            Panel,
            { headerText: 'Renderer' },
            jsx(
                LabelGroup,
                { text: 'Renderer' },
                jsx(SelectInput, {
                    type: 'number',
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'renderer' },
                    value: observer.get('renderer') ?? 0,
                    options: [
                        { v: 0, t: 'Auto' },
                        { v: 1, t: 'Raster (CPU Sort)' },
                        { v: 2, t: 'Raster (GPU Sort)' },
                        { v: 3, t: 'Compute' }
                    ]
                })
            )
        ),
        jsx(
            Panel,
            { headerText: 'Editor Settings' },
            jsx(Button, {
                text: 'Select',
                onClick: () => observer.emit('select')
            }),
            jsx(
                LabelGroup,
                { text: 'Box Size X' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'boxSizeX' },
                    min: 0.1,
                    max: 5.0,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Box Size Y' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'boxSizeY' },
                    min: 0.1,
                    max: 5.0,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Box Size Z' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'boxSizeZ' },
                    min: 0.1,
                    max: 5.0,
                    precision: 2
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Rotation X' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'boxRotationX' },
                    min: -180,
                    max: 180,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Rotation Y' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'boxRotationY' },
                    min: -180,
                    max: 180,
                    precision: 1
                })
            ),
            jsx(
                LabelGroup,
                { text: 'Rotation Z' },
                jsx(SliderInput, {
                    binding: new BindingTwoWay(),
                    link: { observer, path: 'boxRotationZ' },
                    min: -180,
                    max: 180,
                    precision: 1
                })
            ),
            jsx(Button, {
                text: 'Reset Rotation',
                onClick: () => observer.emit('resetRotation')
            }),
            jsx(Button, {
                text: 'Delete Selected',
                onClick: () => observer.emit('deleteSelected')
            }),
            jsx(Button, {
                text: 'Clone Selected',
                onClick: () => observer.emit('cloneSelected')
            })
        )
    );
};
