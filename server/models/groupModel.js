import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        description: {
            type: String,
            trim: true,
        },
        inviteCode: {
            type: String,
            unique: true,
        },
        inviteLink: {
            type: String,
        },
        members: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                },
                name: String, // To allow members not registered yet or for simple visual tracking
                email: String,
                joinedAt: { type: Date, default: Date.now },
            }
        ],
    },
    {
        timestamps: true,
    }
);

const Group = mongoose.model('Group', groupSchema);
export default Group;
